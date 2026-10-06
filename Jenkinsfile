pipeline {
  agent any

  environment {
    DOCKER_USER = 'ruchitasingla'
    BACKEND_IMAGE  = "${DOCKER_USER}/mh-backend"
    FRONTEND_IMAGE = "${DOCKER_USER}/mh-frontend"
    COMPOSE_PROJECT_NAME = 'mental-health-app'
    EC2_HOST = '13.51.158.192'
  }

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  stages {
    stage('Lint') {
      steps {
        dir('backend') {
          sh '''
            python3 -m venv venv
            . venv/bin/activate
            pip install -q -r requirements-dev.txt
            ruff check main.py tests
          '''
        }
      }
    }

    stage('Test') {
      steps {
        dir('backend') {
          sh '. venv/bin/activate && pytest -v'
        }
      }
    }

    stage('Build images') {
      steps {
        sh 'docker compose build --pull'
        sh '''
          docker tag $BACKEND_IMAGE:latest  $BACKEND_IMAGE:$BUILD_NUMBER
          docker tag $FRONTEND_IMAGE:latest $FRONTEND_IMAGE:$BUILD_NUMBER
        '''
      }
    }

    stage('Security scan') {
      steps {
        sh '''
          for IMG in $BACKEND_IMAGE:$BUILD_NUMBER $FRONTEND_IMAGE:$BUILD_NUMBER; do
            echo "=== Scanning $IMG ==="
            docker run --rm \
              -v /var/run/docker.sock:/var/run/docker.sock \
              -v trivy-cache:/root/.cache/ \
              aquasec/trivy:latest image \
              --scanners vuln \
              --severity HIGH,CRITICAL --ignore-unfixed \
              --exit-code 1 $IMG
          done
        '''
      }
    }

    stage('Push images') {
      when { branch 'main' }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub',
                         usernameVariable: 'U', passwordVariable: 'P')]) {
          sh '''
            echo "$P" | docker login -u "$U" --password-stdin
            docker push $BACKEND_IMAGE:latest
            docker push $BACKEND_IMAGE:$BUILD_NUMBER
            docker push $FRONTEND_IMAGE:latest
            docker push $FRONTEND_IMAGE:$BUILD_NUMBER
          '''
        }
      }
    }

    stage('Deploy to EC2') {
      when { branch 'main' }
      steps {
        sshagent(credentials: ['ec2-ssh']) {
          sh '''
            scp -o StrictHostKeyChecking=accept-new docker-compose.prod.yml ubuntu@$EC2_HOST:~/docker-compose.yml
            ssh -o StrictHostKeyChecking=accept-new ubuntu@$EC2_HOST \
              "docker compose pull && docker compose up -d --remove-orphans && docker image prune -f"
          '''
        }
      }
    }

    stage('Smoke test') {
      when { branch 'main' }
      steps {
        sh 'curl -fsS --max-time 5 --retry 5 --retry-delay 3 --retry-connrefused http://$EC2_HOST/api/health'
    }
  }

  post {
    always { sh 'docker logout || true' }
    failure { echo 'Pipeline failed. Check the stage logs above.' }
  }
}
