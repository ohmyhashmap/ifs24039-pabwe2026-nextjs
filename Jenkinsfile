pipeline {
    agent any

    options {
        timestamps()
        skipDefaultCheckout(true)
        // Hentikan stage selanjutnya jika publisher menandai build UNSTABLE / FAILURE
        skipStagesAfterUnstable()
    }

    stages {
        // ============================================================
        // 1. CHECKOUT
        // ============================================================
        stage('Checkout') {
            agent {
                docker {
                    image 'oven/bun:alpine'
                    reuseNode true
                }
            }
            steps {
                checkout scm
            }
        }

        // ============================================================
        // 2. INSTALL DEPENDENCIES
        // ============================================================
        stage('Install Dependencies') {
            agent {
                docker {
                    image 'oven/bun:alpine'
                    reuseNode true
                }
            }
            steps {
                sh '''
                    set -e
                    echo "=== Installing Dependencies ==="
                    bun install
                    echo "=== Dependencies Installed ==="
                '''
            }
        }

        // ============================================================
        // 3. TEST
        // ============================================================
        stage('Test') {
            agent {
                docker {
                    image 'node:24-alpine'
                    reuseNode true
                }
            }
            steps {
                sh '''
                    set -e
                    echo "=== Running Tests with Coverage ==="
                    npx vitest run --coverage
                    echo "=== Tests Passed ==="
                '''
            }
        }

        // ============================================================
        // 4. TRIVY SECURITY SCAN
        // ============================================================
        stage('Trivy Security Scan') {
            agent {
                docker {
                    image 'aquasec/trivy:0.74.0'
                    reuseNode true
                    args '''
                        --entrypoint=""
                        -e HOME=/tmp
                        -e XDG_CACHE_HOME=/tmp/.cache
                    '''
                }
            }
            steps {
                sh '''
                    set -e
                    mkdir -p .trivy-cache

                    echo "======================================"
                    echo "        TRIVY SECURITY SCAN"
                    echo "======================================"

                    echo "=== Trivy Version ==="
                    trivy --version

                    echo "=== Trivy Scan ==="
                    trivy fs \
                        --cache-dir .trivy-cache \
                        --scanners vuln \
                        --severity HIGH,CRITICAL \
                        --format sarif \
                        --output trivy-results.sarif \
                        --exit-code 1 \
                        .

                    echo "=== Trivy Result ==="
                    ls -lh trivy-results.sarif
                '''
            }
            post {
                always {
                    recordIssues(
                        enabledForFailure: true,
                        failOnError: false,
                        tools: [
                            sarif(
                                id: 'trivy',
                                name: 'Trivy Security',
                                pattern: 'trivy-results.sarif'
                            )
                        ]
                    )
                }
            }
        }

        // ============================================================
        // 5. SONARQUBE ANALYSIS
        // ============================================================
        stage('SonarQube Analysis') {
            agent {
                docker {
                    image 'sonarsource/sonar-scanner-cli:latest'
                    reuseNode true
                    args '--network cicd-network'
                }
            }
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '''
                        set -e
                        echo "=== SonarQube Analysis ==="
                        sonar-scanner
                        echo "=== SonarQube Analysis Completed ==="
                    '''
                }
            }
        }

        // ============================================================
        // 6. QUALITY GATE
        // ============================================================
        stage('Quality Gate') {
            steps {
                timeout(time: 30, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // ============================================================
        // 7. PACKAGE APPLICATION
        // ============================================================
        stage('Package Application') {
            agent {
                docker {
                    image 'node:24-alpine'
                    reuseNode true
                    args '-u root'
                }
            }
            steps {
                sh '''
                    set -e
                    echo "======================================"
                    echo "    CREATING APPLICATION PACKAGE"
                    echo "======================================"

                    apk add --no-cache zip unzip
                    rm -f latest-app.zip

                    zip -r latest-app.zip . \
                        -x "node_modules/*" \
                        -x ".git/*" \
                        -x ".env" \
                        -x ".env.*" \
                        -x "coverage/*" \
                        -x ".trivy-cache/*" \
                        -x "latest-app.zip" \
                        -x "trivy-results.sarif"

                    echo "=== Application Package Created ==="
                    ls -lh latest-app.zip

                    echo "=== Package Content ==="
                    unzip -l latest-app.zip
                '''
            }
        }

        // ============================================================
        // 8. PUBLISH APPLICATION
        // ============================================================
        stage('Publish Application') {
            steps {
                archiveArtifacts(
                    artifacts: 'latest-app.zip',
                    fingerprint: true,
                    allowEmptyArchive: false
                )

                script {
                    // Buat Identitas Aplikasi
                    def appName = env.JOB_NAME
                        .replaceAll('[^a-zA-Z0-9._-]', '-')
                        .replaceAll('-+', '-')
                        .replaceAll('^-|-$', '')

                    def buildId = env.BUILD_NUMBER

                    echo "Application Name: ${appName}"
                    echo "Build ID: ${buildId}"

                    // Copy ke User Content
                    sh """
                        set -e
                        echo "======================================"
                        echo "       PUBLISHING USER CONTENT"
                        echo "======================================"

                        docker exec cicd-jenkins \
                            mkdir -p "/var/jenkins_home/userContent/applications/${appName}/${buildId}"

                        docker cp \
                            latest-app.zip \
                            "cicd-jenkins:/var/jenkins_home/userContent/applications/${appName}/${buildId}/latest-app.zip"

                        echo "=== Published File ==="
                        docker exec cicd-jenkins \
                            ls -lh "/var/jenkins_home/userContent/applications/${appName}/${buildId}/latest-app.zip"
                    """

                    // Buat Public Artifact URL
                    def jenkinsBaseUrl = env.BUILD_URL
                        .substring(0, env.BUILD_URL.indexOf('/job/'))
                        .replace('localhost', 'host.docker.internal')

                    env.ARTIFACT_URL = "${jenkinsBaseUrl}/userContent/applications/${appName}/${buildId}/latest-app.zip"

                    echo "======================================"
                    echo "        APPLICATION PUBLISHED"
                    echo "======================================"
                    echo "Artifact URL: ${env.ARTIFACT_URL}"
                }
            }
        }

        // ============================================================
        // 9. DEPLOY APPLICATION
        // ============================================================
        stage('Deploy Application') {
            agent {
                docker {
                    image 'curlimages/curl:8.15.0'
                    reuseNode true
                    args '--network cicd-network'
                }
            }
            steps {
                script {
                    echo "=========================================="
                    echo "      START APPLICATION DEPLOYMENT"
                    echo "=========================================="
                    echo "Artifact URL: ${env.ARTIFACT_URL}"

                    // 1. Request Redeployment
                    echo "\n=== Request Redeployment ==="
                    def redeployResponse = sh(
                        script: '''
                            set -e
                            curl -sS --fail-with-body \
                                -X POST "$URL_REDEPLOY" \
                                -H "Content-Type: application/json" \
                                -d "{
                                    \\"token_access\\": \\"$DEPLOY_TOKEN\\",
                                    \\"website_id\\": \\"$WEBSITE_ID\\",
                                    \\"source_url\\": \\"$ARTIFACT_URL\\",
                                    \\"source_type\\": \\"jenkins\\"
                                }"
                        ''',
                        returnStdout: true
                    ).trim()

                    echo "Redeploy Response:\n${redeployResponse}"

                    // 2. Polling Deployment Progress
                    echo "\n=== Waiting For Deployment ==="
                    def maxAttempts = 120
                    def attempt = 0
                    def deploymentStatus = 'IN_PROGRESS'

                    while (deploymentStatus == 'IN_PROGRESS') {
                        attempt++

                        if (attempt > maxAttempts) {
                            error("Deployment timeout. Status masih IN_PROGRESS setelah ${maxAttempts} attempts.")
                        }

                        sleep time: 5, unit: 'SECONDS'
                        echo "\n=== Checking Deployment Progress (${attempt}/${maxAttempts}) ==="

                        def progressResponse = sh(
                            script: '''
                                set -e
                                curl -sS --fail-with-body \
                                    -X POST "$URL_PROGRESS" \
                                    -H "Content-Type: application/json" \
                                    -d "{
                                        \\"token_access\\": \\"$DEPLOY_TOKEN\\",
                                        \\"website_id\\": \\"$WEBSITE_ID\\"
                                    }"
                            ''',
                            returnStdout: true
                        ).trim()

                        echo "Progress Response:\n${progressResponse}"

                        // Parse Response JSON
                        def json = readJSON text: progressResponse
                        deploymentStatus = json?.data?.status?.toString()?.toUpperCase()

                        if (!deploymentStatus) {
                            error("Response progress tidak memiliki data.status")
                        }

                        echo "Deployment Status: ${deploymentStatus}"

                        if (deploymentStatus == 'SUCCESS') {
                            echo "\n=========================================="
                            echo "       ✅ DEPLOYMENT SUCCESS"
                            echo "=========================================="
                            break
                        }

                        if (deploymentStatus == 'FAIL') {
                            def deploymentLog = json?.data?.log ?: 'Deployment failed tanpa log.'
                            echo "\n=========================================="
                            echo "       ❌ DEPLOYMENT FAILED"
                            echo "=========================================="
                            echo "\n========== DEPLOYMENT LOG =========="
                            echo deploymentLog
                            echo "===================================="

                            error("Deployment gagal untuk website ${WEBSITE_ID}")
                        }

                        echo "Deployment masih berjalan..."
                    }

                    echo "\n=========================================="
                    echo "       DEPLOYMENT FINISHED"
                    echo "=========================================="
                }
            }
        }
    }

    // ================================================================
    // POST ACTIONS
    // ================================================================
    post {
        always {
            archiveArtifacts(
                artifacts: 'trivy-results.sarif',
                allowEmptyArchive: true
            )
        }

        success {
            echo "=========================================="
            echo "       ✅ PIPELINE SUCCESS"
            echo "=========================================="
            echo "Result: ${currentBuild.currentResult}"
            echo "📦 Artifact: ${env.ARTIFACT_URL ?: '(not published)'}"
            echo "🚀 Website berhasil dideploy."
        }

        failure {
            echo "=========================================="
            echo "       ❌ PIPELINE FAILED"
            echo "=========================================="
            echo "Result: ${currentBuild.currentResult}"
            echo "Periksa log stage yang merah / Console Output untuk penyebab gagal."
        }

        unstable {
            echo "=========================================="
            echo "       ⚠️ PIPELINE UNSTABLE"
            echo "=========================================="
            echo "Result: ${currentBuild.currentResult}"
        }
    }
}