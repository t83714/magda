terraform {
  # The modules used in this example have been updated with 0.12 syntax, which means the example is no longer
  # compatible with any versions below 0.12.
  required_version = ">= 0.12"
}

data "aws_s3_bucket_object" "cert_data_file" {
  bucket = "${var.cert_s3_bucket}"
  key    = "${var.cert_s3_key}"
}

locals {
  cert_data              = data.aws_s3_bucket_object.cert_data_file.body != null ? jsondecode(data.aws_s3_bucket_object.cert_data_file.body) : {}
  current_cert_timestamp = tonumber(replace(timestamp(), "/[-| |T|Z|:]/", ""))
  create_new_cert        = (local.current_cert_timestamp >= lookup(local.cert_data, "expiry", 0) || lookup(local.cert_data, "domain_root", "") != var.external_domain_root) ? true : false
  current_cert_data = {
    id              = acme_certificate.certificate[0].id
    domain_root     = var.external_domain_root
    expiry          = (local.current_cert_timestamp + (var.cert_min_days_remaining * 1000000))
    private_key_pem = acme_certificate.certificate[0].private_key_pem
    certificate_pem = acme_certificate.certificate[0].certificate_pem
    issuer_pem      = acme_certificate.certificate[0].issuer_pem
  }
  current_cert_data_json = jsonencode(local.current_cert_data)
}

resource "tls_private_key" "private_key" {
  count     = local.create_new_cert ? 1 : 0
  algorithm = "RSA"
  depends_on = [
    data.aws_s3_bucket_object.cert_data_file
  ]
}

resource "acme_registration" "reg" {
  count           = local.create_new_cert ? 1 : 0
  account_key_pem = "${tls_private_key.private_key[0].private_key_pem}"
  email_address   = "${var.acme_email}"
  depends_on = [
    data.aws_s3_bucket_object.cert_data_file
  ]
}

resource "acme_certificate" "certificate" {
  count           = local.create_new_cert ? 1 : 0
  account_key_pem = "${acme_registration.reg[0].account_key_pem}"
  common_name     = "*.${var.external_domain_root}"

  dns_challenge {
    provider = "route53"
  }
  depends_on = [
    data.aws_s3_bucket_object.cert_data_file
  ]
}

resource "aws_s3_bucket_object" "object" {
  count   = local.create_new_cert ? 1 : 0
  bucket  = "${var.cert_s3_bucket}"
  key     = "${var.cert_s3_key}"
  content = "${local.current_cert_data_json}"
  etag    = "${md5(local.current_cert_data_json)}"
  depends_on = [
    data.aws_s3_bucket_object.cert_data_file
  ]
}
