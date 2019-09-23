# ------------------------------------------------------------------------------
# MASTER OUTPUTS
# ------------------------------------------------------------------------------

output "cluster_name" {
  description = "The name of the cluster instance"
  value       = "${google_container_cluster.primary_magda_cluster.name}"
}

output "node_pool_name" {
  description = "The name of the node pool instance"
  value       = "${google_container_node_pool.primary_magda_node_pool.name}"
}