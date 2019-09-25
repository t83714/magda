# ------------------------------------------------------------------------------
# MASTER OUTPUTS
# ------------------------------------------------------------------------------

output "db_password" {
  description = "Cluster DB password"
  value       = "${local.db_password}"
}

output "jwt_secret" {
  description = "Cluster JWT secret"
  value       = "${local.jwt_secret}"
}

output "session_secret" {
  description = "Cluster Session secret"
  value       = "${local.session_secret}"
}

output "provisioner_id" {
  value = "${local.provisioner_id}"
}
