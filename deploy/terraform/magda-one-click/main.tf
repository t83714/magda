provider "google-beta" {
  version     = "~> 2.7.0"
  project     = var.project
  region      = var.region
  credentials = "${file(var.credential_file_path)}"
}

locals {
  kube_cert_json = "{\"apiVersion\":\"networking.gke.io/v1beta1\",\"kind\":\"ManagedCertificate\",\"metadata\":{\"name\":\"magda-certificate\"},\"spec\":{\"domains\":[\"${module.external_ip.address}.xip.io\"]}}"
  ingress_json   = "{\"apiVersion\":\"apiVersion: extensions/v1beta1\",\"kind\":\"Ingress\",\"metadata\":{\"name\":\"magda-ingress\",\"annotations\":{\"kubernetes.io/ingress.global-static-ip-name\":\"${module.external_ip.address}.xip.io\",\"networking.gke.io/managed-certificates\":\"magda-certificate\"}},\"spec\":{\"backend\":{\"serviceName\":\"gateway\",\"servicePort\":\"http\"}}}"
}

terraform {
  # The modules used in this example have been updated with 0.12 syntax, which means the example is no longer
  # compatible with any versions below 0.12.
  required_version = ">= 0.12"
}

provider "kubernetes" {

}

module "external_ip" {
  source  = "../google-reserved-ip"
}

module "cluster" {
  source  = "../google-cluster"
  project = var.project
  region  = var.region
}

resource "kubernetes_namespace" "magda_namespace" {
  metadata {
    name = "${var.namespace}"
  }
  depends_on = [
    module.cluster
  ]
}

resource "helm_release" "magda_helm_release" {
  name       = "magda"
  repository = "https://charts.magda.io/"
  chart      = "magda"

  namespace = "${var.namespace}"

  values = [
    "${file("../../helm/magda-dev.yml")}"
  ]

  set {
    name  = "externalUrl"
    value = "http://${module.external_ip.address}.xip.io/"
  }

  depends_on = [
    module.cluster
  ]
}

# We need this hack only because k8s terraform provider can't support the latest API
resource "null_resource" "after_helm_deployment" {
  # When to trigger the cmd
  depends_on = [
    helm_release.magda_helm_release
  ]

  provisioner "local-exec" {
    command    = "echo '${local.kube_cert_json}' | kubectl apply"
    on_failure = "fail"
  }

  provisioner "local-exec" {
    command    = "echo '${local.ingress_json}' | kubectl apply"
    on_failure = "fail"
  }

}

