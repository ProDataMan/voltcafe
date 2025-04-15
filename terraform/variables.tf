variable "aws_region" {
  description = "AWS region to deploy in"
  default     = "us-west-1"
}

variable "key_name" {
  description = "Name of the SSH key pair in AWS"
  type        = string
  default = "volt-cafe"
}

variable "private_key_path" {
  description = "Path to your private SSH key file (.pem)"
  type        = string
  default = "volt-cafe.pem"
}

variable "ami_id" {
  description = "AMI ID for the EC2 instance"
  type        = string
  default     = "ami-04f7a54071e74f488" # Ubuntu 22.04 LTS (us-west-1)
}

variable "postgres_password" {
  type        = string
  # sensitive   = true
  description = "Password for the PostgreSQL postgres user"
  default = "Pa$$w0rd"
}

