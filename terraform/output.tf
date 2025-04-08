# Debug outputs
output "existing_env_content" {
  value       = local.existing_env
  description = "Content of the original .env file"
}

output "updated_env_content" {
  value       = local.updated_env
  description = "Content of the updated .env file"
}

output "public_ip" {
  value = aws_instance.voltcafe_server.public_ip
}