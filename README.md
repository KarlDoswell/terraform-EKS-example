# terraform-EKS-example
An Example of EKS set up through Terraform, with a sample app deployed

## Guide to spinning up a VM on AWS
(following https://learn.hashicorp.com/tutorials/terraform/aws-build?in=terraform/aws-get-started)
- Set up an AWS Account (free forever tier)
- Creted an access key via the console. This gives a public-private key pair. Use this in the `aws configure` command to set up the aws cli
- Created a simple terraform file with the provider blocks complete
```hcl 
resource "aws_instance" "app_server" {
  ami           = "ami-033af134328c47f48"  #The AMI is region locked, Used console to find appropriate AMI
  instance_type = "t2.micro"

  tags = {
    Name = "ExampleAppServerInstance"
  }
}
```
- run `terraform init`
- run `terraform fmt` to check the formatting, and `terraform validate` to check it is a valid
- run `terraform plan` to view  a plan of what will be created.
- run `terraform apply` to create the infrastucture in the cloud
- have a look at the console to confirm that the EC2 instance has been generated
- run `terraform detroy` to remove the EC2 instance

## Containerising and Storing myApp in the cloud (ECR)
- Containerise the app using the docker file. `docker build -t myapp .`
- run to make sure it's working fine `docker run -t -i -p 8080:8080 myapp`
- login to docker via aws ecr using the below
```
aws ecr get-login-password \
    --region <region> \
| docker login \
    --username AWS \
    --password-stdin <aws_account_id>.dkr.ecr.<region>.amazonaws.com
```
- Next create a repo in ecr
```
aws ecr create-repository \
    --repository-name myapp \
    --image-scanning-configuration scanOnPush=true \
    --region eu-west-2
```
315528473023
- tag and push the image
```
docker tag myapp:latest 315528473023.dkr.ecr.eu-west-2.amazonaws.com/myapp:latest

docker push 315528473023.dkr.ecr.eu-west-2.amazonaws.com/myapp:latest
```
- thank the smart people that came up with CI pipelines so you don't have to manually do this all the time.


## Spinning up a cluster in EKS
Now we have our AWS account and terraform all working and a containerised app ready to go, we can go ahead and attempt to spin up a EKS cluster and deploy the image.
Following this guide here https://learn.hashicorp.com/tutorials/terraform/eks
By Following the guide, Add a few more terraform files
- versions.tf           -> Provides the terraform provider versions
- kubernetes.tf         -> Provides kubernetes as the provider
- vpc.tf                -> Provisions a VPC for our new cluster
- security-groups.tf    -> Provisions security groups for the EKS instance
- eks-cluster.tf        -> Provisions all the resources required for EKS
- outputs.tf            -> Lists all the outputs that we want from terraform

run `terraform init` to provision the new providers
run `terraform apply` to create the 51 new resources.

we can generate a new kubernetes config entry for this cluster by running `aws eks --region $(terraform output -raw region) update-kubeconfig --name $(terraform output -raw cluster_name)`

## Putting app in EKS
Following the guide, we will first deploy the metric server from it, then we can deploy our app
using wget we can get the metrics server `wget -O v0.3.6.tar.gz https://codeload.github.com/kubernetes-sigs/metrics-server/tar.gz/v0.3.6 && tar -xzf v0.3.6.tar.gz`
which we can then deploy the kubernetes configs `kubectl apply -f metrics-server-0.3.6/deploy/1.8+/`
By checking the deployment is up and healthy, we can check this has all worked as expected
`kubectl get deployment metrics-server -n kube-system`

Next we need the dashboard, this time we apply a raw file from the internet.
`kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.0.0-beta8/aio/deploy/recommended.yaml`

and finally to view it, we can proxy to local machine
`kubectl proxy`
and we should then find it here 
`http://127.0.0.1:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/#/login`


In order to use this dashboard, we need to authenticate. This can be done via ClusterRoleBinding. In a new terminal (since we want to keep the proxy running)
`kubectl apply -f https://raw.githubusercontent.com/hashicorp/learn-terraform-provision-eks-cluster/master/kubernetes-dashboard-admin.rbac.yaml`
and generate an auth token
`kubectl -n kube-system describe secret $(kubectl -n kube-system get secret | grep service-controller-token | awk '{print $1}')`

By using this token, we can log into the dashboard.
And with that the metric server is deployed and working.

Now for our app:
- Create a service and deployment yaml file for the app
- apply it to the cluster `kubectl apply -f app-deployment.yaml`
- run `kubectl get pods` to view the pod there