provider "aws" {
  region = var.aws_region
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnet" "default" {
  vpc_id            = data.aws_vpc.default.id
  availability_zone = "${var.aws_region}a"
}

resource "tls_private_key" "voltcafe_key" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "local_file" "voltcafe_key_file" {
  count    = fileexists("${var.private_key_path}") ? 0 : 1
  content  = tls_private_key.voltcafe_key.private_key_pem
  filename = var.private_key_path
}

resource "local_file" "voltcafe_key_pub_file" {
  count    = fileexists("${var.private_key_path}.pub") ? 0 : 1
  content  = tls_private_key.voltcafe_key.public_key_openssh
  filename = "${var.private_key_path}.pub"
}

locals {
  existing_pub_key = fileexists("${var.private_key_path}") && fileexists("${var.private_key_path}.pub") ? file("${var.private_key_path}.pub") : ""
  public_key       = length(trimspace(local.existing_pub_key)) > 0 ? local.existing_pub_key : tls_private_key.voltcafe_key.public_key_openssh
  existing_env     = fileexists("../.env") ? file("../.env") : ""
  env_lines        = split("\n", local.existing_env)

  updated_lines = distinct(concat(
    [ for line in local.env_lines : line if !startswith(line, "REDIRECT_URI=") && !startswith(line, "POSTGRES_HOST=") && !startswith(line, "POSTGRES_DB=") && !startswith(line, "POSTGRES_USER=") && !startswith(line, "POSTGRES_PASSWORD=") && !startswith(line, "POSTGRES_PORT=") ],
    [
      "REDIRECT_URI=https://${aws_instance.voltcafe_server.public_ip}:3000/callback",
      "POSTGRES_HOST=${aws_instance.voltcafe_server.public_ip}",
      "POSTGRES_DB=volt_cafe",
      "POSTGRES_USER=postgres",
      "POSTGRES_PASSWORD=${var.postgres_password}",
      "POSTGRES_PORT=5432"
    ]
  ))

  updated_env = join("\n", local.updated_lines)
}

resource "aws_key_pair" "voltcafe_key" {
  key_name   = var.key_name
  public_key = local.public_key
}

resource "aws_security_group" "voltcafe_sg" {
  name        = "voltcafe-sg"
  description = "Allow SSH, HTTP, HTTPS, Node.js, and PostgreSQL"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "voltcafe_server" {
  ami             = var.ami_id
  instance_type   = "t2.micro"
  key_name        = aws_key_pair.voltcafe_key.key_name
  security_groups = [aws_security_group.voltcafe_sg.name]

  user_data = <<-EOF
    #!/bin/bash
    echo "Instance starting" > /var/log/user-data.log
  EOF

  tags = {
    Name = "VoltCafe-Server"
  }
}



resource "local_file" "env_file" {
  depends_on = [aws_instance.voltcafe_server]
  content    = local.updated_env
  filename   = "../.env.generated"
  lifecycle {
    create_before_destroy = true
  }
}

resource "null_resource" "deploy_files" {
  depends_on = [
    aws_instance.voltcafe_server,
    local_file.env_file,
    local_file.voltcafe_key_pub_file
  ]

  provisioner "remote-exec" {
    inline = [
      "sudo mkdir -p /var/www/voltcafe",
      "sudo chown ubuntu:ubuntu /var/www/voltcafe",
      "sudo apt-get update",
      "sudo apt-get install -y apache2 nodejs npm openssl postgresql postgresql-contrib",
      "sudo systemctl enable apache2",
      "sudo systemctl start apache2",
      "sudo npm install -g pm2"
    ]
  }

  provisioner "file" {
    source      = "../server.js"
    destination = "/var/www/voltcafe/server.js"
  }

  provisioner "file" {
    source      = "../.env.generated"
    destination = "/var/www/voltcafe/.env"
  }

  provisioner "file" {
    content     = local.public_key
    destination = "/var/www/voltcafe/public-key.pem"
  }

  provisioner "file" {
    source      = "${path.module}/init_volt_cafe.sql"
    destination = "/tmp/init_volt_cafe.sql"
  }

  provisioner "remote-exec" {
    inline = [
      # 1. Set the password
      "sudo -u postgres psql -c \"ALTER USER postgres WITH PASSWORD 'Test123'\" || echo 'Failed to set password'",

      # 2. Update listen and auth settings
      "POSTGRES_CONF=$(sudo find /etc/postgresql -name postgresql.conf | head -n 1)",
      "PG_HBA_CONF=$(sudo find /etc/postgresql -name pg_hba.conf | head -n 1)",
      "sudo sed -i \"s/^#*listen_addresses.*/listen_addresses = '*'/\" \"$POSTGRES_CONF\"",
      "echo 'host all all 0.0.0.0/0 md5' | sudo tee -a \"$PG_HBA_CONF\"",
      "echo 'host all all 127.0.0.1/32 md5' | sudo tee -a \"$PG_HBA_CONF\"",
      "echo 'host all all ::1/128 md5' | sudo tee -a \"$PG_HBA_CONF\"",

      # 3. Restart PostgreSQL to apply the above changes
      "sudo systemctl restart postgresql",

      # 4. Now test password-based login
      "PGPASSWORD='Test123' psql -U postgres -h localhost -d postgres -c '\\conninfo' || echo 'Password test failed'",

      # 5. Proceed with app setup
      "cd /var/www/voltcafe",
      "npm init -y",
      "npm install express axios dotenv querystring pg cors",
      "sudo -u postgres createdb volt_cafe || true",
      "sudo -u postgres psql -d volt_cafe -f /tmp/init_volt_cafe.sql",

      # 6. Set up PM2
      "pm2 start server.js --name voltcafe -f",
      "pm2 save",
      "sudo pm2 startup systemd -u ubuntu --hp /home/ubuntu",

      # 7. Enable required Apache modules
      "sudo a2enmod ssl proxy proxy_http",
      "sudo systemctl restart apache2"
    ]
  }

  connection {
    type        = "ssh"
    user        = "ubuntu"
    private_key = fileexists("${var.private_key_path}") ? file("${var.private_key_path}") : tls_private_key.voltcafe_key.private_key_pem
    host        = aws_instance.voltcafe_server.public_ip
  }
}

resource "null_resource" "react_build" {
  depends_on = [local_file.env_file, aws_instance.voltcafe_server]

  provisioner "local-exec" {
    working_dir = "${path.module}/../VoltCafeUI"
    command = <<EOT
      echo "Cleaning build artifacts..."
      rm -rf dist node_modules package-lock.json
      echo "Installing dependencies..."
      npm install > build-install.log 2>&1 || { echo "npm install failed"; cat build-install.log; exit 1; }
      echo "Building React app with API_BASE..."
      echo "EC2 Public IP: ${aws_instance.voltcafe_server.public_ip}" >> build.log
      export REACT_APP_API_BASE=http://${aws_instance.voltcafe_server.public_ip}:3000
      npm run build > build.log 2>&1 || { echo "npm run build failed"; cat build.log; exit 1; }
      echo "Verifying dist folder..."
      ls -l dist >> build.log
      grep -r "http://${aws_instance.voltcafe_server.public_ip}:3000" dist/static/js >> build.log
    EOT
  }

  triggers = {
    always_run = "${timestamp()}"
  }
}

module "react_app" {
  source         = "./react_app_deploy"
  server_ip      = aws_instance.voltcafe_server.public_ip
  react_build_path = "${path.module}/../VoltCafeUI/dist"
  private_key    = tls_private_key.voltcafe_key.private_key_pem
  env_file_path  = local_file.env_file.filename

  depends_on = [
    null_resource.deploy_files,
    null_resource.react_build
  ]
}

