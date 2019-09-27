terraform {
  # The modules used in this example have been updated with 0.12 syntax, which means the example is no longer
  # compatible with any versions below 0.12.
  required_version = ">= 0.12"
}

# apiVersion: v1
# kind: Secret
# metadata:
#   name: testsecret-tls
#   namespace: default
# data:
#   tls.crt: base64 encoded cert
#   tls.key: base64 encoded key
# type: kubernetes.io/tls
resource "kubernetes_secret" "magda_cert_tls" {
  metadata {
    name      = "magda-cert-tls"
    namespace = "${var.namespace}"
  }

  data = {
    "tls.crt" = "${module.certificate.issuer_pem}${module.certificate.certificate_pem}"
    "tls.key" = "${module.certificate.private_key_pem}"
  }

  type = "kubernetes.io/tls"

  depends_on = [
    kubernetes_cluster_role_binding.default_service_acc_role_binding,
    module.certificate
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
    module.certificate,
    kubernetes_secret.magda_cert_tls
  ]
}
