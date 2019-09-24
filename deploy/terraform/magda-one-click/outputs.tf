# ------------------------------------------------------------------------------
# MASTER OUTPUTS
# ------------------------------------------------------------------------------

output "metadata" {
  description = "The metadata of the helm deployment"
  value       = "${helm_release.magda_helm_release.metadata}"
}
