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

variable "domain_root" {
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
# ---------------------------------------------------------------------------------------------------------------------
# OPTIONAL PARAMETERS
# Generally, these values won't need to be changed.
# ---------------------------------------------------------------------------------------------------------------------
variable "acme_email" {
  type        = string
  description = "ACME email; Default to contact@magda.io"
  default     = "contact@magda.io"
}

variable "aws_default_region" {
  type        = string
  description = "AWS default region; Default to sydney"
  default     = "ap-southeast-2"
}

variable "acme_server_url" {
  type        = string
  description = "ACME server url; Default to let's letsencrypt staging endpoint (higher limit for testing)"
  default     = "https://acme-staging-v02.api.letsencrypt.org/directory"
}