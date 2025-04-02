provider "aws" {
  region     = var.aws_region
  access_key = var.aws_access_key_id
  secret_key = var.aws_secret_access_key
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

# Local variable to determine public key with validation
locals {
  existing_pub_key = fileexists("${var.private_key_path}") && fileexists("${var.private_key_path}.pub") ? file("${var.private_key_path}.pub") : ""
  public_key       = length(trimspace(local.existing_pub_key)) > 0 ? local.existing_pub_key : tls_private_key.voltcafe_key.public_key_openssh
}

# Create or ensure key pair exists in AWS
resource "aws_key_pair" "voltcafe_key" {
  key_name   = var.key_name
  public_key = local.public_key
}

# Security Group for EC2
resource "aws_security_group" "voltcafe_sg" {
  name        = "voltcafe-sg"
  description = "Allow SSH, HTTP, and Node.js traffic"
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
  ami             = "ami-04f7a54071e74f488" # Ubuntu 22.04 LTS (us-west-1)
  instance_type   = "t2.micro"
  key_name        = aws_key_pair.voltcafe_key.key_name
  security_groups = [aws_security_group.voltcafe_sg.name]

  user_data = <<-EOF
              #!/bin/bash
              apt-get update
              apt-get install -y apache2 nodejs npm
              systemctl enable apache2
              systemctl start apache2
              EOF

  tags = {
    Name = "VoltCafe-Server"
  }
}

# Copy files to EC2 and ensure directory exists
resource "null_resource" "deploy_files" {
  depends_on = [aws_instance.voltcafe_server]

  provisioner "remote-exec" {
    inline = [
      "sudo mkdir -p /var/www/voltcafe",
      "sudo chown ubuntu:ubuntu /var/www/voltcafe"
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
      "cd /var/www/voltcafe",
      "npm init -y",
      "npm install express axios dotenv querystring",
      "node server.js &"
    ]
  }

  connection {
    type        = "ssh"
    user        = "ubuntu"
    private_key = fileexists("${var.private_key_path}") ? file("${var.private_key_path}") : tls_private_key.voltcafe_key.private_key_pem
    host        = aws_instance.voltcafe_server.public_ip
  }
}