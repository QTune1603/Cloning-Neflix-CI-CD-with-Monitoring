pipeline {
    agent any

    tools {
        jdk 'jdk17'
        nodejs 'node16'
    }

    environment {
        SCANNER_HOME = tool 'sonar-scanner'
        DOCKER_IMAGE = 'qitune/neflix'
        DOCKER_CREDENTIALS_ID = 'docker'
    }

    stages {
        stage('Clean Workspace'){
            steps {
                cleanWs()
            }
        }
        stage('Checkout'){
            steps {
                checkout scm
            }
        }
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('sonar-server') {
                    sh "${SCANNER_HOME}/bin/sonar-scanner -Dsonar.projectName=Neflix-Clone -Dsonar.projectKey=netflix-clone"
                }
            }
        }
        stage("Quality Gate") {
            steps {
                script {
                    waitForQualityGate abortPipeline: false, credentialsId: 'Sonar-token'
                }
            }
        }
        stage('Install Dependencies') {
            steps {
                sh "npm install"
            }
        }
        stage('OWASP FS SCAN') {
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    dependencyCheck additionalArguments: '--scan ./ --disableYarnAudit --disableNodeAudit', odcInstallation: 'DP-Check'
                    dependencyCheckPublisher pattern: '**/dependency-check-report.xml'
                }
            }
        }
        stage('TRIVY FS SCAN') {
            steps {
                sh "trivy fs . > trivyfs.txt"
            }
        }
        stage("Docker Build & Push"){
            steps{
                script{
                    withDockerRegistry(credentialsId: DOCKER_CREDENTIALS_ID){
                        sh "docker build -t  neflix ."
                        sh "docker tag neflix ${DOCKER_IMAGE}:latest"
                        sh "docker push ${DOCKER_IMAGE}:latest"
                    }
                }
            }
        }
        
        stage("TRIVY Image Scan") {
            steps{
                sh "trivy image ${DOCKER_IMAGE}:latest > trivyimage.txt" 
            }
        }

        stage("Deploy to container") {
            steps{
                sh 'docker rm -f neflix-app || true'
                sh "docker run -d --name neflix-app -p 8081:80 ${DOCKER_IMAGE}:latest"
            }
        }
    }

    post {
        always {
            emailext (
                attachLog: true,
                subject: "Report Build Jenkins - ${currentBuild.fullDisplayName} - ${currentBuild.currentResult}",
                body: """
                <h2>Result Build: ${currentBuild.currentResult}</h2>
                <p>Project: ${env.JOB_NAME}</p>
                <p>Build Number: ${env.BUILD_NUMBER}</p>
                <p>Route Clarify: ${env.BUILD_URL}</p>
                <p>View attachment to see the security result from Trivy(trivufs.txt and trivyimage.txt)</p> 
                """ ,
                to: 'tungonlytop2@gmail.com', 
                attachmentsPattern: 'trivyfs.txt,trivyimage.txt'
            )
        }
    }
}