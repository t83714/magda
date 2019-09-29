terraform {
  # The modules used in this example have been updated with 0.12 syntax, which means the example is no longer
  # compatible with any versions below 0.12.
  required_version = ">= 0.12"
}

provider "aws" {
  region     = "${var.aws_default_region}"
  access_key = "${var.aws_access_key}"
  secret_key = "${var.aws_secret_key}"
}

provider "acme" {
  server_url = "${var.acme_server_url}"
}

locals {
  domain_common_name = "*.${var.domain_root}"
  timestamp          = timestamp()
  current_cert_status_data = {
    id        = acme_certificate.certificate.id
    domain    = local.domain_common_name
    timestamp = local.timestamp
  }
  current_cert_status_data_json = jsonencode(local.current_cert_status_data)
  current_cert_data = {
    id              = acme_certificate.certificate.id
    domain          = local.domain_common_name
    timestamp       = local.timestamp
    private_key_pem = acme_certificate.certificate.private_key_pem
    certificate_pem = acme_certificate.certificate.certificate_pem
    issuer_pem      = acme_certificate.certificate.issuer_pem
  }
  current_cert_data_json = jsonencode(local.current_cert_data)
}

resource "tls_private_key" "private_key" {
  algorithm = "RSA"
}

resource "acme_registration" "reg" {
  account_key_pem = "${tls_private_key.private_key.private_key_pem}"
  email_address   = "${var.acme_email}"
}

resource "acme_certificate" "certificate" {
  account_key_pem = "${acme_registration.reg.account_key_pem}"
  common_name     = local.domain_common_name

  dns_challenge {
    provider = "route53"
    config = {
      AWS_ACCESS_KEY_ID     = "${var.aws_access_key}"
      AWS_SECRET_ACCESS_KEY = "${var.aws_secret_key}"
      AWS_DEFAULT_REGION    = "${var.aws_default_region}"
    }
  }
}

resource "aws_s3_bucket_object" "update_cert_data" {
  bucket       = "${var.cert_s3_bucket}"
  key          = "${var.cert_s3_folder}/cert_data.json"
  content      = "${local.current_cert_data_json}"
  etag         = "${md5(local.current_cert_data_json)}"
  content_type = "application/json"
  acl          = "private"
}

resource "aws_s3_bucket_object" "update_cert_status_data" {
  bucket       = "${var.cert_s3_bucket}"
  key          = "${var.cert_s3_folder}/cert_status.json"
  content      = "${local.current_cert_status_data_json}"
  etag         = "${md5(local.current_cert_status_data_json)}"
  content_type = "application/json"
  acl          = "public-read"
}
