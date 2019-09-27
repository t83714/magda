# ------------------------------------------------------------------------------
# MASTER OUTPUTS
# ------------------------------------------------------------------------------

output "common_name" {
  description = "The actual domain on the certificate"
  value       = "*.${var.external_domain_root}"
}

output "private_key_pem" {
  description = "The private key pem of the certificate"
  value       = acme_certificate.certificate[0].private_key_pem
}

output "certificate_pem" {
  description = "The certificate pem of the certificate"
  value       = acme_certificate.certificate[0].certificate_pem
}

output "issuer_pem" {
  description = "The issuer pem of the certificate"
  value       = acme_certificate.certificate[0].issuer_pem
}