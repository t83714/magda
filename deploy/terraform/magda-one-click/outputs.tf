# ------------------------------------------------------------------------------
# MASTER OUTPUTS
# ------------------------------------------------------------------------------

output "status" {
  description = "The status of the helm deployment"
  value       = "${kubernetes_ingress.magda_default_ingress.status}"
}

output "values" {
  description = "The status of the helm deployment"
  value = "${kubernetes_ingress.magda_default_ingress.values}"
}