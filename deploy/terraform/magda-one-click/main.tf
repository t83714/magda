provider "google-beta" {
  version = "~> 2.7.0"
  project = var.project
  region  = var.region
}

locals {
  kube_cert_json = "{\"apiVersion\":\"networking.gke.io/v1beta1\",\"kind\":\"ManagedCertificate\",\"metadata\":{\"name\":\"magda-certificate\"},\"spec\":{\"domains\":[\"${module.external_ip.address}.xip.io\"]}}"
}

terraform {
  # The modules used in this example have been updated with 0.12 syntax, which means the example is no longer
  # compatible with any versions below 0.12.
  required_version = ">= 0.12"
}

provider "kubernetes" {
    
}

module "external_ip" {
  source = "./google-reserved-ip"
  project = var.project
}

module "cluster" {
  source = "./google-cluster"
  project = var.project
  region = var.region
}

resource "kubernetes_namespace" "magda_namespace" {
  metadata {
    name = "${var.namespace}"
  }
}

resource "helm_release" "magda" {
    name      = "magda"
    repository = "https://charts.magda.io/"
    chart     = "magda"

    namespace = "${kubernetes_namespace.magda_namespace.name}"

    values = [
        "${file("../../helm/magda-dev.yaml")}"
    ]

    set {
        name  = "externalUrl"
        value = "http://${module.external_ip.address}.xip.io/"
    }
}

resource "kubernetes_ingress" "magda_default_ingress" {
    provisioner "local-exec" {
        command = "echo '${local.kube_cert_json}' | kubectl apply"
        on_failure = "fail"
    }
    metadata {
        name = "magda-default-ingress"
        annotations = {
            "kubernetes.io/ingress.global-static-ip-name" = "${module.external_ip.address}.xip.io"
            "networking.gke.io/managed-certificates" = "magda-certificate"
        }
    }
}

