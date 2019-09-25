# this var is for seting up dependency relationship
# so secrets only created when cluster is created and accessible
# Reason we need this is because `depend_on` is not supported on child module as of Sep 2019 T_T
# See here https://github.com/hashicorp/terraform/issues/10462
# P.S. `depend_on` on module should be released soon
# see here: https://www.hashicorp.com/resources/a-2nd-tour-of-terraform-0-12#future-plans
variable "provisioner_id" {
  description = "The ID or name of the cluster provisioner; The provisioner should make sure correct kubectl env has been setup."
  type        = string
}

variable "namespace" {
  description = "The namespace where the secret should be created"
  type        = string
}

# ---------------------------------------------------------------------------------------------------------------------
# OPTIONAL PARAMETERS
# Generally, these values won't need to be changed.
# ---------------------------------------------------------------------------------------------------------------------

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

