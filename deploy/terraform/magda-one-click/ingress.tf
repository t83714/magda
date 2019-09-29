terraform {
  # The modules used in this example have been updated with 0.12 syntax, which means the example is no longer
  # compatible with any versions below 0.12.
  required_version = ">= 0.12"
}

data "aws_s3_bucket_object" "cert_data" {
  bucket = "${var.cert_s3_bucket}"
  key    = "${var.cert_s3_folder}/cert_data.json"
}

locals {
  cert_data  = jsondecode(aws_s3_bucket_object.cert_data.body)
  issuer_pem = lookup(local.cert_data, "issuer_pem", "")
  certificate_pem = lookup(local.cert_data, "certificate_pem", "")
  private_key_pem = lookup(local.cert_data, "private_key_pem", "")
}

data "aws_route53_zone" "external_domain_zone" {
  name         = "${var.external_domain_root}."
}

resource "aws_route53_record" "complete_domain" {
  zone_id = "${aws_route53_zone.external_domain_zone.zone_id}"
  name    = "${replace(module.external_ip.address, ".", "-")}"
  type    = "A"
  ttl     = "300"
  records = ["${external_ip.address}"]
}

resource "kubernetes_secret" "magda_cert_tls" {
  metadata {
    name      = "magda-cert-tls"
    namespace = "${var.namespace}"
  }

  data = {
    "tls.crt" = "${local.certificate_pem}${local.issuer_pem}"
    "tls.key" = "${local.private_key_pem}"
  }

  type = "kubernetes.io/tls"

  depends_on = [
    kubernetes_cluster_role_binding.default_service_acc_role_binding
  ]
}

# Ingress will be created before helm complete as it takes time 
resource "kubernetes_ingress" "default" {
  metadata {
    name      = "magda-primary-ingress"
    namespace = "${var.namespace}"
    annotations = {
      "kubernetes.io/ingress.global-static-ip-name" = module.external_ip.name
    }
  }

  spec {
    tls {
      secret_name = "magda-cert-tls"
    }
    backend {
      service_name = "gateway"
      service_port = 80
    }
  }

  depends_on = [
    kubernetes_cluster_role_binding.default_service_acc_role_binding,
    kubernetes_secret.magda_cert_tls
  ]
}
