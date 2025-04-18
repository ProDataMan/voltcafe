resource "null_resource" "react_deploy" {
  depends_on = [ var.private_key, var.server_ip ]

  provisioner "file" {
    source      = "../VoltCafeUI/dist"
    destination = "/tmp/voltcafe-ui"
    connection {
      type        = "ssh"
      user        = "ubuntu"
      private_key = var.private_key
      host        = var.server_ip
    }
  }

  provisioner "file" {
    source      = "${path.module}/apache/voltcafe-ui.conf"
    destination = "/tmp/voltcafe-ui.conf"
  }

provisioner "remote-exec" {
  inline = [
    "sudo mkdir -p /var/www/voltcafe-ui",
    "sudo rm -rf /var/www/voltcafe-ui/*",
    "sudo cp -r /tmp/voltcafe-ui/* /var/www/voltcafe-ui/",
    "sudo cp /tmp/voltcafe-ui.conf /etc/apache2/sites-available/voltcafe-ui.conf",
    "sudo chown -R www-data:www-data /var/www/voltcafe-ui",
    "sudo chmod -R 755 /var/www/voltcafe-ui",
    "sudo a2dissite 000-default.conf",
    "sudo a2ensite voltcafe-ui.conf",
    "sudo systemctl reload apache2"
  ]
}

  connection {
    type        = "ssh"
    user        = "ubuntu"
    private_key = var.private_key
    host        = var.server_ip
  }
}

