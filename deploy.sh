REDEPLOY=$1

if [ "$REDEPLOY" = 'deploy' ] || [ "$REDEPLOY" = 'redeploy' ]
then
    # Build docker image of the service locally
    docker build -t provider:latest .

    docker tag provider:latest 482053628475.dkr.ecr.eu-central-1.amazonaws.com/usupport-provider-api

    # Push image to 
    docker push 482053628475.dkr.ecr.eu-central-1.amazonaws.com/usupport-provider-api

    if [ "$REDEPLOY" = 'deploy' ]
    then
        # Update Kuberenetes Cluster applications for this API service
        kubectl apply -f config.yaml -f secrets.yaml -f deployment.yaml -f service.yaml
    elif [ "$REDEPLOY" = 'redeploy' ]
    then 
        kubectl apply -f config.yaml -f secrets.yaml -f service.yaml
        kubectl rollout restart deployment provider
    fi

else
    echo "Please select either to deploy or redeploy k8s pod"
fi
