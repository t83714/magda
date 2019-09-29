# ------------------------------------------------------------------------------
# MASTER OUTPUTS
# ------------------------------------------------------------------------------

output "common_name" {
  description = "The actual domain on the certificate"
  value       = local.domain_common_name
}

output "issue_date" {
  description = "The issue date of the certificate"
  value       = local.timestamp
}

output "private_key_pem" {
  description = "The private key pem of the certificate"
  value       = acme_certificate.certificate.private_key_pem
}

output "certificate_pem" {
  description = "The certificate pem of the certificate"
  value       = acme_certificate.certificate.certificate_pem
}

output "issuer_pem" {
  description = "The issuer pem of the certificate"
  value       = acme_certificate.certificate.issuer_pem
}
