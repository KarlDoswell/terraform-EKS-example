# terraform-EKS-example
An Example of EKS set up through Terraform, with a sample app deployed

## Guide to spinning up a VM on AWS
(following https://learn.hashicorp.com/tutorials/terraform/aws-build?in=terraform/aws-get-started)
- Set up an AWS Account (free forever tier)
- Creted an access key via the console. This gives a public-secrect key pair. Use this in the `aws configure` command to set up the aws cli
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
- tag and push the image
```
docker tag myapp:latest 315528473023.dkr.ecr.eu-west-2.amazonaws.com/myapp:latest

docker push 315528473023.dkr.ecr.eu-west-2.amazonaws.com/myapp:latest
```
- say thank you the smart people that came up with CI pipelines so you don't have to manually do this all the time on real projects.


## Spinning up a cluster in EKS
Now we have our AWS account, Terraform all working and a containerised app ready to go, we can go ahead and attempt to spin up a EKS cluster and deploy the app.
Following this guide here https://learn.hashicorp.com/tutorials/terraform/eks
By Following the guide, Add a few more terraform files
- versions.tf           -> Provides the terraform provider versions
- kubernetes.tf         -> Provides kubernetes as the provider
- vpc.tf                -> Provisions a VPC for our new cluster
- security-groups.tf    -> Provisions security groups for the EKS instance
- eks-cluster.tf        -> Provisions all the resources required for EKS - We use the EKS module from terraform rather than specifying it all ourselves.
- outputs.tf            -> Lists all the outputs that we want from terraform

To better explain what some of these things are, we have:
- A Virtual Private Cloud (VPC) - A private network on the public cloud, which keeps your network isolated. Pretty much all resources on AWS are required to operate in a VPC
- Security Groups - A security group is essentially a list of permissions to allow access to specific instances. In our case these will apply to the worker nodes
- Worker Groups (inside the eks-cluster.tf file) - These are the worker nodes for the cluster, which under the hood are EC2 instances, although by using a "node group" they allow for autoscaling. This allows us to specify the node resource size as well as the security group.

run `terraform init` to provision the new providers
run `terraform apply` to create the 51 new resources.

we can generate a new kubernetes config entry for this cluster by running 

`aws eks --region $(terraform output -raw region) update-kubeconfig --name $(terraform output -raw cluster_name)`

This will also auto select it, but to navigate around kubernetes config contexts we can use
`kubectl config get-contexts` to view them all - a * denotes the currently selected one.
`kubectl config use-context <context-name>` to select one
`kubectl config current-context` to get the name of the current one

## Putting app in EKS
Following the guide, we will first deploy the metric server from it, then we can deploy our app. Navigate to the kubernetes folder, and using wget we can get the metrics server 

`wget -O v0.3.6.tar.gz https://codeload.github.com/kubernetes-sigs/metrics-server/tar.gz/v0.3.6 && tar -xzf v0.3.6.tar.gz`

which we can then deploy the kubernetes configs

`kubectl apply -f metrics-server-0.3.6/deploy/1.8+/`

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
- run `kubectl get pods` to check that the pod is there


Additionally, we can tty into the cluster, and curl it directly (as we have nothing exposed currently).
First we need to know the IP the app is running on.
We can run 
`kubectl get pods -l app=my-app` and look for the internal IP

To access the cluster we can use
`winpty kubectl run -i --tty --rm debug --image=giantswarm/tiny-tools --restart=Never sh`

then finally 
`curl <IP>:<Port>` should return "healthy"
`curl <IP>:<Port>/hello` should return "hello world" 

# Quick restart to this point
 
Since EKS charges per hour, and this is only traing, we want to bring the infrastrucuture down when not doing training so we don't rack up costs and then to spin it back up quickly when we get back to training. 

To take it down we use
`terraform detroy`

Then to put it back up (to this point, not including any additions further on in this guide), first go to the terraform folder

`terraform init`

`terraform apply`

`aws eks --region $(terraform output -raw region) update-kubeconfig --name $(terraform output -raw cluster_name)`

navigate to the kubernetes folder
`cd ../kubernetes/`
`kubectl apply -f app-deployment.yaml`

# Helm

## installing nginx ingress using helm
For our infrastructure we will use helm V3, so firstly we need to make sure we have the CLI installed, once that's done we can get on with using it. Ensuring your conected to the correct cluster (by using `kubectl config current-context`), let us add the chart to our repo

`helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx`

Then ensure we have the most up to date version

`helm repo update`

and finally install it into the cluster

`helm install ingress-nginx ingress-nginx/ingress-nginx`

it should say a success message, but we can check it has created it by using 

`kubectl get services`
 
 and checking for the nginx ingress service

All helm does is install the necessary parts to use the igress, we still need to create a ingress resource in kubernetes. 
Luckily we have a `ingress.yaml`, Which has a speicification of the external-ip, which we should be able to see from the previous get services command. Update the external Ip, then we we can apply the ingress to the cluster

`kubectl apply -f ingress.yaml`

Once that's up and running, you can check that address and check that it returns "healthy" and add a `/hello` to the url to check it returns "hello world" 



# TODO
- package up something into own custom helm chart
  - Run a upgrade on that helm chart, including a pre/post-upgrade hook
