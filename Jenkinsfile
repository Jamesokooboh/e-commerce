pipeline {
    agent any

    environment {
        DOCKERHUB_USER  = 'okoobohjames'
        ECR_REGISTRY    = '313951301623.dkr.ecr.us-east-1.amazonaws.com'
        AWS_REGION      = 'us-east-1'
        IMAGE_TAG       = "${env.BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Backend Image') {
            steps {
                sh "docker build -t ${DOCKERHUB_USER}/ecommerce-backend:${IMAGE_TAG} -t ${DOCKERHUB_USER}/ecommerce-backend:latest ./backend"
            }
        }

        stage('Build Frontend Image') {
            steps {
                sh "docker build -t ${DOCKERHUB_USER}/ecommerce-frontend:${IMAGE_TAG} -t ${DOCKERHUB_USER}/ecommerce-frontend:latest ./frontend"
            }
        }

        stage('Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
                    sh '''
                        echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
                        docker push ${DOCKERHUB_USER}/ecommerce-backend:${IMAGE_TAG}
                        docker push ${DOCKERHUB_USER}/ecommerce-backend:latest
                        docker push ${DOCKERHUB_USER}/ecommerce-frontend:${IMAGE_TAG}
                        docker push ${DOCKERHUB_USER}/ecommerce-frontend:latest
                    '''
                }
            }
        }

        stage('Push to AWS ECR') {
            steps {
                withCredentials([
                    string(credentialsId: 'aws-access-key-id', variable: 'AWS_ACCESS_KEY_ID'),
                    string(credentialsId: 'aws-secret-access-key', variable: 'AWS_SECRET_ACCESS_KEY')
                ]) {
                    sh '''
                        aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

                        docker tag ${DOCKERHUB_USER}/ecommerce-backend:${IMAGE_TAG} ${ECR_REGISTRY}/ecommerce-backend:${IMAGE_TAG}
                        docker tag ${DOCKERHUB_USER}/ecommerce-backend:latest ${ECR_REGISTRY}/ecommerce-backend:latest
                        docker push ${ECR_REGISTRY}/ecommerce-backend:${IMAGE_TAG}
                        docker push ${ECR_REGISTRY}/ecommerce-backend:latest

                        docker tag ${DOCKERHUB_USER}/ecommerce-frontend:${IMAGE_TAG} ${ECR_REGISTRY}/ecommerce-frontend:${IMAGE_TAG}
                        docker tag ${DOCKERHUB_USER}/ecommerce-frontend:latest ${ECR_REGISTRY}/ecommerce-frontend:latest
                        docker push ${ECR_REGISTRY}/ecommerce-frontend:${IMAGE_TAG}
                        docker push ${ECR_REGISTRY}/ecommerce-frontend:latest
                    '''
                }
            }
        }

        stage('Verify Images') {
            steps {
                sh '''
                    docker pull ${DOCKERHUB_USER}/ecommerce-backend:${IMAGE_TAG}
                    docker pull ${ECR_REGISTRY}/ecommerce-backend:${IMAGE_TAG}
                '''
            }
        }
    }

    post {
        always {
            sh 'docker logout || true'
        }
    }
}
