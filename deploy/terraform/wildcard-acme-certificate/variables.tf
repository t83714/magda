# ---------------------------------------------------------------------------------------------------------------------
# REQUIRED PARAMETERS
# These variables are expected to be passed in by the operator
# ---------------------------------------------------------------------------------------------------------------------
variable "aws_access_key" {
  type        = string
  description = "AWS access key"
}

variable "aws_secret_key" {
  type        = string
  description = "AWS secret key"
}

variable "external_domain_root" {
  type        = string
  description = "The external domain root: e.g. if we provide `demo.magda.io` here, the final accessible domain will be xxx-xxx-xxx-xx.demo.magda.io"
}

variable "cert_s3_bucket" {
  type        = string
  description = "the s3 bucket that stores the certificate"
}

variable "cert_s3_folder" {
  type        = string
  description = "the s3 folder that stores the certificate data files"
}

variable "timestamp" {
  type        = number
  description = "unix timestamp; used to determine whether need to re-generate a new cert"
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

variable "aws_default_region" {
  type        = string
  description = "AWS default region; Default to sydney"
  default     = "ap-southeast-2"
}