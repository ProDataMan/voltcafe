variable "server_ip" {
  description = "The IP address of the server hosting the React app"
  type        = string
}

variable "private_key" {
  type        = string
  description = "The SSH private key contents"
}



variable "react_build_path" {
  description = "Local path to React build folder (dist or build)"
  type        = string
}

variable "env_file_path" {
  type = string
}

