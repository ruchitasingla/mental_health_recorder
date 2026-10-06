pipeline {
  agent any

  environment {
    DOCKER_USER = 'ruchitasingla'
    BACKEND_IMAGE  = "${DOCKER_USER}/mh-backend"
    FRONTEND_IMAGE = "${DOCKER_USER}/mh-frontend"
    COMPOSE_PROJECT_NAME = 'mental-health-app'
  }

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

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

    stage('Deploy') {
      when { branch 'main' }
      steps {
        sh 'docker compose up -d --remove-orphans'
        sh 'sleep 8 && docker compose exec -T backend python -c "import urllib.request; print(urllib.request.urlopen(\'http://localhost:8000/health\').read())"'
      }
    }
  }

  post {
    always { sh 'docker logout || true' }
    failure { echo 'Pipeline failed. Check the stage logs above.' }
  }
}   