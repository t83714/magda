# ---------------------------------------------------------------------------------------------------------------------
# REQUIRED PARAMETERS
# These variables are expected to be passed in by the operator
# ---------------------------------------------------------------------------------------------------------------------

variable "project" {
  description = "The project ID to host the deployed Magda"
  type = string
}

variable "region" {
  type = string
  description = "The region to host the deployed Magda"
}

variable "namespace" {
  type = string
  description = "The namespace to host the deployed Magda"
}
