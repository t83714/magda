# ---------------------------------------------------------------------------------------------------------------------
# REQUIRED PARAMETERS
# These variables are expected to be passed in by the operator
# ---------------------------------------------------------------------------------------------------------------------
variable "external_domain_root" {
  type        = string
  description = "The external domain root: e.g. if we provide `demo.magda.io` here, the final accessible domain will be xxx-xxx-xxx-xx.demo.magda.io"
}

variable "cert_s3_bucket" {
  type        = string
  description = "the s3 bucket that stores the certificate"
}

variable "cert_s3_key" {
  type        = string
  description = "the s3 key that stores the certificate"
}
# ---------------------------------------------------------------------------------------------------------------------
# OPTIONAL PARAMETERS
# Generally, these values won't need to be changed.
# ---------------------------------------------------------------------------------------------------------------------
variable "acme_email" {
  type        = string
  description = "ACME email; Default to contact@magda.io"
  default     = "contact@magda.io"
}

variable "cert_min_days_remaining" {
  type        = string
  description = "The minimum amount of days remaining on the expiration of a certificate before a renewal is attempted. The default is 30"
  default     = 30
}