provider "aws" {
  region = var.aws_region
  # Credentials sourced from AWS CLI config or environment variables
}

# VPC and Subnet (default VPC for simplicity)
data "aws_vpc" "default" {
  default = true
}

data "aws_subnet" "default" {
  vpc_id            = data.aws_vpc.default.id
  availability_zone = "${var.aws_region}a"
}

# Generate key pair locally
resource "tls_private_key" "voltcafe_key" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

# Save private key to file if not exists
resource "local_file" "voltcafe_key_file" {
  count    = fileexists("${var.private_key_path}") ? 0 : 1
  content  = tls_private_key.voltcafe_key.private_key_pem
  filename = var.private_key_path
}

# Save public key to file if not exists
resource "local_file" "voltcafe_key_pub_file" {
  count    = fileexists("${var.private_key_path}.pub") ? 0 : 1
  content  = tls_private_key.voltcafe_key.public_key_openssh
  filename = "${var.private_key_path}.pub"
}

# Local variable to determine public key and .env content
locals {
  existing_pub_key = fileexists("${var.private_key_path}") && fileexists("${var.private_key_path}.pub") ? file("${var.private_key_path}.pub") : ""
  public_key       = length(trimspace(local.existing_pub_key)) > 0 ? local.existing_pub_key : tls_private_key.voltcafe_key.public_key_openssh
  existing_env     = fileexists("../.env") ? file("../.env") : ""
  env_lines        = split("\n", local.existing_env)
  updated_env_lines = [
    for line in local.env_lines : 
    startswith(trimspace(line), "REDIRECT_URI=") ? 
    "REDIRECT_URI=https://${aws_instance.voltcafe_server.public_ip}:3000/callback" : # Changed to https
    line
  ]
  has_redirect     = length([for line in local.env_lines : line if startswith(trimspace(line), "REDIRECT_URI=")]) > 0
  final_env_lines  = local.has_redirect ? local.updated_env_lines : concat(local.updated_env_lines, ["REDIRECT_URI=https://${aws_instance.voltcafe_server.public_ip}:3000/callback"])
  updated_env      = join("\n", local.final_env_lines)
}

# Create or ensure key pair exists in AWS
resource "aws_key_pair" "voltcafe_key" {
  key_name   = var.key_name
  public_key = local.public_key
}

# Security Group for EC2
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
    from_port   = 443 # Added HTTPS port
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

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# EC2 Instance
resource "aws_instance" "voltcafe_server" {
  ami             = var.ami_id
  instance_type   = "t2.micro"
  key_name        = aws_key_pair.voltcafe_key.key_name
  security_groups = [aws_security_group.voltcafe_sg.name]

  # Minimal user_data to avoid conflicts
  user_data = <<-EOF
              #!/bin/bash
              echo "Instance starting" > /var/log/user-data.log
              EOF

  tags = {
    Name = "VoltCafe-Server"
  }
}

# Update existing .env file with dynamic REDIRECT_URI
resource "local_file" "env_file" {
  depends_on = [aws_instance.voltcafe_server]
  content    = local.updated_env
  filename   = "../.env"
  lifecycle {
    create_before_destroy = true
  }
}

# Copy files to EC2 and ensure directory exists
resource "null_resource" "deploy_files" {
  depends_on = [aws_instance.voltcafe_server, local_file.env_file]

  provisioner "remote-exec" {
    inline = [
      "sudo mkdir -p /var/www/voltcafe",
      "sudo chown ubuntu:ubuntu /var/www/voltcafe",
      "sudo apt-get update",
      "sudo apt-get install -y apache2 nodejs npm openssl", # Added openssl for certificate generation
      "sudo systemctl enable apache2",
      "sudo systemctl start apache2",
      "sudo npm install -g pm2 || { echo 'Failed to install PM2'; exit 1; }",
    ]
  }

  provisioner "file" {
    source      = "../server.js"
    destination = "/var/www/voltcafe/server.js"
  }

  provisioner "file" {
    source      = "../public-key.pem"
    destination = "/var/www/voltcafe/public-key.pem"
  }

  provisioner "file" {
    source      = "../.env"
    destination = "/var/www/voltcafe/.env"
  }

  provisioner "remote-exec" {
    inline = [
      "echo 'Deploying .env content:'",
      "cat /var/www/voltcafe/.env || echo 'Failed to read .env on server'",
      # Generate self-signed SSL certificate
      "sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/voltcafe.key -out /etc/ssl/certs/voltcafe.crt -subj '/CN=${aws_instance.voltcafe_server.public_ip}'",
      # Enable SSL module and configure Apache
      "sudo a2enmod ssl",
      "sudo bash -c 'cat > /etc/apache2/sites-available/default-ssl.conf <<EOF\n<VirtualHost *:443>\n  SSLEngine on\n  SSLCertificateFile /etc/ssl/certs/voltcafe.crt\n  SSLCertificateKeyFile /etc/ssl/private/voltcafe.key\n  ProxyPreserveHost On\n  ProxyPass / http://localhost:3000/\n  ProxyPassReverse / http://localhost:3000/\n</VirtualHost>\nEOF'",
      "sudo a2ensite default-ssl.conf",
      # Keep HTTP config for port 80 (optional redirect to HTTPS later)
      "sudo bash -c 'cat > /etc/apache2/sites-available/000-default.conf <<EOF\n<VirtualHost *:80>\n  ProxyPreserveHost On\n  ProxyPass / http://localhost:3000/\n  ProxyPassReverse / http://localhost:3000/\n</VirtualHost>\nEOF'",
      "cd /var/www/voltcafe",
      "npm init -y || { echo 'Failed to init npm'; exit 1; }",
      "npm install express axios dotenv querystring || { echo 'Failed to install dependencies'; exit 1; }",
      "pm2 start server.js --name voltcafe || { echo 'Failed to start PM2'; exit 1; }",
      "pm2 save",
      "sudo pm2 startup systemd -u ubuntu --hp /home/ubuntu",
      "sudo a2enmod proxy",
      "sudo a2enmod proxy_http",
      "sudo systemctl restart apache2"
    ]
    on_failure = fail
  }

  connection {
    type        = "ssh"
    user        = "ubuntu"
    private_key = fileexists("${var.private_key_path}") ? file("${var.private_key_path}") : tls_private_key.voltcafe_key.private_key_pem
    host        = aws_instance.voltcafe_server.public_ip
  }
}