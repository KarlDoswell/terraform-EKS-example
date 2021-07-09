# file for single VM instance
# terraform {
#   required_providers {
#     aws = {
#       source  = "hashicorp/aws"
#       version = "~> 3.27"
#     }
#   }

#   required_version = ">= 0.14.9"
# }

# provider "aws" { 
#   profile = "default"
#   region  = "eu-west-2"
# }

# resource "aws_instance" "app_server" {
#   ami           = "ami-033af134328c47f48"
#   instance_type = "t2.micro"

#   tags = {
#     Name = "ExampleAppServerInstance"
#   }
# }
