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

variable "credential_file_path" {
  type = string
  description = "Google service account key file path"
}

variable "db_password" {
  description = "The db password; Will auto created if not specfied"
  type        = string
  default     = null
}

variable "jwt_secret" {
  description = "The jwt_secret; Will auto created if not specfied"
  type        = string
  default     = null
}

variable "session_secret" {
  description = "The session_secret; Will auto created if not specfied"
  type        = string
  default     = null
}

variable "facebook_client_secret" {
  description = "facebook SSO client secret; Will not create if not specfied"
  type        = string
  default     = null
}

variable "google_client_secret" {
  description = "google SSO client secret; Will not create if not specfied"
  type        = string
  default     = null
}

variable "arcgis_client_secret" {
  description = "arcgis SSO client secret; Will not create if not specfied"
  type        = string
  default     = null
}

variable "vanguard_certificate" {
  description = "vanguard SSO certificate; Will not create if not specfied"
  type        = string
  default     = null
}

variable "smtp_username" {
  description = "smtp server username; Will not create if not specfied"
  type        = string
  default     = null
}

variable "smtp_password" {
  description = "smtp server password; Will not create if not specfied"
  type        = string
  default     = null
}

variable "kubernetes_dashboard" {
  type  = bool
  description = "Whether turn on kubernetes_dashboard or not; Default: false"
  default = false
}

