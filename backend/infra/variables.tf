variable "project_id" {
  type        = string
  description = "Target GCP project id."
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "Region for Cloud Run and Artifact Registry."
}

variable "firestore_location" {
  type        = string
  default     = "nam5"
  description = "Firestore location (multi-region like nam5/eur3, or a single region)."
}

variable "service_name" {
  type        = string
  default     = "oshi-arena-api"
  description = "Cloud Run service name."
}

variable "image" {
  type        = string
  description = "Fully-qualified container image (build & push before apply)."
}

variable "allowed_origins" {
  type        = list(string)
  default     = ["https://oshiarena.com", "https://www.oshiarena.com"]
  description = "Browser origins allowed by CORS."
}
