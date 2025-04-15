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

  filtered_env_lines = [
    for line in local.env_lines :
    line if !startswith(trimspace(line), "REDIRECT_URI=")
  ]

  redirect_uri_line = "REDIRECT_URI=https://${aws_instance.voltcafe_server.public_ip}:3000/callback"

  final_env_lines = concat(local.filtered_env_lines, [local.redirect_uri_line])
  updated_env     = join("\n", local.final_env_lines)
}

resource "aws_key_pair" "voltcafe_key" {
  key_name   = var.key_name
  public_key = local.public_key
}

resource "aws_security_group" "voltcafe_sg" {
  name        = "voltcafe-sg"
  description = "Allow SSH, HTTP, HTTPS, and Node.js traffic"
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
    #prevent_destroy = true
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
      "sudo apt-get install -y apache2 nodejs npm openssl",
      "sudo systemctl enable apache2",
      "sudo systemctl start apache2",
      "sudo npm install -g pm2 || { echo 'Failed to install PM2'; exit 1; }"
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

  # Upload SQL script to server
  provisioner "file" {
    source      = "${path.module}/init_volt_cafe.sql"
    destination = "/tmp/init_volt_cafe.sql"
  }


  provisioner "remote-exec" {
    inline = [
      "echo 'Deploying .env content:'",
      "cat /var/www/voltcafe/.env || echo 'Failed to read .env on server'",
      "sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/voltcafe.key -out /etc/ssl/certs/voltcafe.crt -subj \"/CN=${aws_instance.voltcafe_server.public_ip}\"",
      "sudo a2enmod ssl",
      "sudo bash -c \"echo '<VirtualHost *:443>\n  SSLEngine on\n  SSLCertificateFile /etc/ssl/certs/voltcafe.crt\n  SSLCertificateKeyFile /etc/ssl/private/voltcafe.key\n  ProxyPreserveHost On\n  ProxyPass / http://localhost:3000/\n  ProxyPassReverse / http://localhost:3000/\n</VirtualHost>' > /etc/apache2/sites-available/default-ssl.conf\"",
      "sudo a2ensite default-ssl.conf",
      "sudo bash -c \"echo '<VirtualHost *:80>\n  ProxyPreserveHost On\n  ProxyPass / http://localhost:3000/\n  ProxyPassReverse / http://localhost:3000/\n</VirtualHost>' > /etc/apache2/sites-available/000-default.conf\"",
      "cd /var/www/voltcafe",
      "npm init -y || { echo 'Failed to init npm'; exit 1; }",
      "npm install express axios dotenv querystring || { echo 'Failed to install dependencies'; exit 1; }",
      "pm2 start server.js --name voltcafe -f || pm2 restart voltcafe || { echo 'Failed to start or restart PM2'; exit 1; }",
      "pm2 save",
      "sudo pm2 startup systemd -u ubuntu --hp /home/ubuntu",
      "sudo a2enmod proxy",
      "sudo a2enmod proxy_http",
      "sudo systemctl restart apache2"
    ]
  }

  provisioner "remote-exec" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y postgresql postgresql-contrib",
      "sudo -u postgres psql -c \"ALTER USER postgres PASSWORD '${var.postgres_password}';\"",
      "sudo -u postgres createdb volt_cafe",
      "sudo -u postgres psql -d volt_cafe -f /tmp/init_volt_cafe.sql"
    ]
  }

  connection {
    type        = "ssh"
    user        = "ubuntu"
    private_key = fileexists("${var.private_key_path}") ? file("${var.private_key_path}") : tls_private_key.voltcafe_key.private_key_pem
    host        = aws_instance.voltcafe_server.public_ip
  }
}
