# Dự Án DevSecOps: Triển Khai Netflix Clone Với Jenkins, Docker, K3s Kubernetes & Hệ Thống Giám Sát (Prometheus + Grafana)

Dự án này hướng dẫn chi tiết cách xây dựng một quy trình **DevSecOps CI/CD chuyên nghiệp** từ đầu để kiểm tra, quét bảo mật, đóng gói và triển khai ứng dụng **Netflix Clone (React + Vite)**. Quy trình bao gồm việc tích hợp các công cụ bảo mật hàng đầu (SAST, SCA, Image Scan) và triển khai ứng dụng lên cụm **Kubernetes (K3s)**. Ngoài ra, dự án còn hướng dẫn thiết lập hệ thống giám sát thời gian thực bằng bộ đôi **Prometheus & Grafana**.

---

## 🏗️ Kiến Trúc Hệ Thống & Các Công Cụ Sử Dụng

*   **Frontend**: React (Vite) - Giao diện Netflix Clone tối giản nhưng hiện đại và mượt mà.
*   **CI/CD Engine**: Jenkins - Điều phối toàn bộ quy trình tích hợp và triển khai liên tục.
*   **Quét Bảo Mật & Chất Lượng (DevSecOps)**:
    *   **SonarQube**: Phân tích chất lượng mã nguồn (Code Quality) và phát hiện lỗ hổng bảo mật tĩnh (SAST).
    *   **OWASP Dependency-Check**: Quét các thư viện phụ thuộc (SCA) để phát hiện các lỗ hổng bảo mật đã công bố (CVE).
    *   **Trivy**: Quét bảo mật hệ thống tệp tin (Filesystem) và quét các lớp bảo mật của Docker Image.
*   **Đóng gói**: Docker (Multi-stage build tối ưu kích thước ảnh, chạy bằng Nginx Alpine).
*   **Triển khai**: Kubernetes (sử dụng **K3s** cực kỳ nhẹ, tối ưu tài nguyên).
*   **Giám sát (Monitoring)**: Prometheus, Node Exporter, và Grafana.

---

## 🖥️ Chuẩn Bị Tài Nguyên Máy Chủ trên AWS

Vì chạy rất nhiều dịch vụ nặng cùng một lúc (Jenkins, SonarQube, Prometheus, Grafana, Docker, K3s), máy ảo mặc định `t2.micro` của AWS sẽ bị quá tải ngay lập tức.

> [!IMPORTANT]
> **Yêu cầu cấu hình tối thiểu:**
> *   **Hệ điều hành**: Ubuntu 22.04 LTS hoặc Ubuntu 24.04 LTS
> *   **Instance Type**: `t2.large` hoặc `m7i-flex.large` (2 vCPUs, 8GB RAM)
> *   **Ổ cứng (Storage)**: Tối thiểu **30GB gp3 SSD** *(AWS mặc định là 8GB, nếu không chỉnh lên 30GB, hệ thống sẽ bị lỗi đầy ổ cứng khi quét SonarQube và Jenkins)*.

### Cấu hình Security Group (Inbound Rules)
Hãy mở các cổng sau trên AWS EC2 Security Group:

| Cổng (Port) | Dịch Vụ / Công Cụ | Ghi Chú |
| :--- | :--- | :--- |
| `22` | SSH | Quản trị máy chủ |
| `8080` | Jenkins | Giao diện quản lý Jenkins |
| `9000` | SonarQube | Giao diện quản lý chất lượng code SonarQube |
| `9090` | Prometheus | Hệ thống thu thập metrics |
| `9100` | Node Exporter | Thu thập chỉ số tài nguyên phần cứng của máy chủ |
| `3000` | Grafana | Giao diện hiển thị Dashboard giám sát |
| `30007` | Kubernetes App | NodePort để truy cập ứng dụng Netflix Clone trên K8s Cluster |

---

## 🛠️ Hướng Dẫn Cài Đặt

### Bước 1: Thiết Lập Swap Space (Bộ Nhớ Ảo)
Để đảm bảo máy chủ hoạt động ổn định, không bị tắt đột ngột do hết RAM vật lý, hãy tạo thêm 4GB Swap:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Cấu hình tự động mount khi khởi động lại máy chủ
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab

# Kiểm tra lại dung lượng RAM & Swap
free -h
```

---

### Bước 2: Cài Đặt Docker, Java 21, Jenkins & Trivy

1. **Cài đặt các thư viện cần thiết & Java 21 (Temurin JDK):**
   ```bash
   sudo apt update -y
   sudo apt install -y wget apt-transport-https gnupg lsb-release ca-certificates
   
   # Thêm key và repo Adoptium cho Java 21
   sudo mkdir -p /etc/apt/keyrings
   wget -O - https://packages.adoptium.net/artifactory/api/gpg/key/public | sudo tee /etc/apt/keyrings/adoptium.asc
   echo "deb [signed-by=/etc/apt/keyrings/adoptium.asc] https://packages.adoptium.net/artifactory/deb $(awk -F= '/^VERSION_CODENAME/{print$2}' /etc/os-release) main" | sudo tee /etc/apt/sources.list.d/adoptium.list
   
   sudo apt update -y
   sudo apt install temurin-21-jdk -y
   java --version
   ```

2. **Cài đặt Jenkins (sử dụng GPG key mới nhất):**
   ```bash
   sudo wget -O /usr/share/keyrings/jenkins-keyring.asc https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key
   echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
   
   sudo apt-get update -y
   sudo apt-get install jenkins -y
   sudo systemctl start jenkins
   sudo systemctl enable jenkins
   ```

3. **Cài đặt Docker và phân quyền cho người dùng:**
   ```bash
   sudo apt-get install docker.io -y
   sudo usermod -aG docker $USER
   sudo usermod -aG docker jenkins # Cấp quyền chạy docker cho Jenkins
   sudo chmod 666 /var/run/docker.sock
   sudo systemctl restart jenkins
   ```

4. **Cài đặt Trivy (Công cụ quét lỗ hổng bảo mật):**
   ```bash
   wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor | sudo tee /usr/share/keyrings/trivy.gpg > /dev/null
   echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
   sudo apt-get update
   sudo apt-get install trivy -y
   ```

*(Khởi động lại session SSH bằng cách đăng nhập lại hoặc chạy lệnh `newgrp docker` để áp dụng quyền Docker)*.

---

### Bước 3: Chạy SonarQube Bằng Docker

Khởi chạy nhanh SonarQube LTS Community container:

```bash
docker run -d --name sonar -p 9000:9000 sonarqube:lts-community
```

* Đợi khoảng 1-2 phút cho SonarQube khởi động hoàn tất.
* Truy cập `http://<IP_MÁY_CHỦ>:9000` (Tài khoản mặc định: `admin` / `admin`. Hệ thống sẽ yêu cầu đổi mật khẩu ngay lập tức).

---

### Bước 4: Thiết Lập Hệ Thống Giám Sát (Prometheus & Node Exporter)

#### 4.1. Cài đặt Prometheus
Tạo tài khoản hệ thống chuyên dụng cho Prometheus:
```bash
sudo useradd --system --no-create-home --shell /bin/false prometheus
```

Tải xuống và cấu hình Prometheus:
```bash
wget https://github.com/prometheus/prometheus/releases/download/v2.47.1/prometheus-2.47.1.linux-amd64.tar.gz
tar -xvf prometheus-2.47.1.linux-amd64.tar.gz
sudo mkdir -p /data /etc/prometheus

cd prometheus-2.47.1.linux-amd64/
sudo mv prometheus promtool /usr/local/bin/
sudo mv consoles/ console_libraries/ /etc/prometheus/
sudo mv prometheus.yml /etc/prometheus/prometheus.yml
sudo chown -R prometheus:prometheus /etc/prometheus/ /data/
cd ..
rm -rf prometheus-2.47.1.linux-amd64*
```

Tạo Service Systemd cho Prometheus:
```bash
sudo nano /etc/systemd/system/prometheus.service
```

Config:
```ini
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
User=prometheus
Group=prometheus
Type=simple
Restart=on-failure
RestartSec=5s
ExecStart=/usr/local/bin/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/data \
  --web.console.templates=/etc/prometheus/consoles \
  --web.console.libraries=/etc/prometheus/console_libraries \
  --web.listen-address=0.0.0.0:9090 \
  --web.enable-lifecycle

[Install]
WantedBy=multi-user.target
```

Khởi động Prometheus:
```bash
sudo systemctl daemon-reload
sudo systemctl enable prometheus
sudo systemctl start prometheus
```

#### 4.2. Cài đặt Node Exporter
Tạo tài khoản hệ thống và cài đặt:
```bash
sudo useradd --system --no-create-home --shell /bin/false node_exporter
wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
tar -xvf node_exporter-1.6.1.linux-amd64.tar.gz
sudo mv node_exporter-1.6.1.linux-amd64/node_exporter /usr/local/bin/
rm -rf node_exporter-1.6.1.linux-amd64*
```

Tạo Service Systemd cho Node Exporter:
```bash
sudo nano /etc/systemd/system/node_exporter.service
```

Config:
```ini
[Unit]
Description=Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
Restart=on-failure
RestartSec=5s
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
```

Khởi động Node Exporter:
```bash
sudo systemctl daemon-reload
sudo systemctl enable node_exporter
sudo systemctl start node_exporter
```

#### 4.3. Đăng ký Node Exporter & Jenkins vào Prometheus
Mở file `/etc/prometheus/prometheus.yml`:
```bash
sudo nano /etc/prometheus/prometheus.yml
```

Thêm job giám sát Node Exporter và Jenkins (sau khi cài đặt Jenkins ở bước sau):
```yaml
  - job_name: 'node_exporter'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'jenkins'
    metrics_path: '/prometheus/'
    static_configs:
      - targets: ['localhost:8080']
```

Tải lại cấu hình Prometheus:
```bash
curl -X POST http://localhost:9090/-/reload
```

---

### Bước 5: Cài Đặt & Cấu Huring Grafana

Cài đặt Grafana Server:
```bash
sudo apt-get install -y apt-transport-https software-properties-common
sudo mkdir -p /etc/apt/keyrings/
wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/grafana.gpg > /dev/null
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com/oss/deb stable main" | sudo tee /etc/apt/sources.list.d/grafana.list
sudo apt-get update
sudo apt-get install grafana -y

sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

#### Cấu hình Dashboard trên Grafana:
1. Đăng nhập vào `http://<IP_MÁY_CHỦ>:3000` (Tài khoản mặc định: `admin` / `admin`).
2. **Add Data Source**: Chọn **Prometheus** -> Điền URL: `http://localhost:9090` -> Nhấn **Save & test**.
3. **Import Dashboard**:
   * Dashboard giám sát Server: Nhập ID **`1860`** -> Chọn Data Source Prometheus -> Nhấn **Import**.
   * Dashboard giám sát Jenkins: Nhập ID **`9964`** -> Chọn Data Source Prometheus -> Nhấn **Import**.

---

### Bước 6: Thiết Lập Jenkins & Cài Plugin

#### 6.1. Mở khóa Jenkins lần đầu
Truy cập `http://<IP_MÁY_CHỦ>:8080`.
Lấy mật khẩu admin ban đầu:
```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```
Chọn **Install suggested plugins** và tiến hành tạo tài khoản admin.

#### 6.2. Cài đặt các plugin cần thiết
Vào **Manage Jenkins** -> **Plugins** -> **Available Plugins**, tìm và cài đặt các plugin sau:
1. **Eclipse Temurin Installer** (Cài đặt JDK tự động).
2. **SonarQube Scanner** (Tích hợp quét code tĩnh).
3. **NodeJS** (Build ứng dụng React).
4. **OWASP Dependency-Check** (Quét phụ thuộc phần mềm).
5. **Docker Pipeline** (Hỗ trợ build & push Docker image trong Jenkinsfile).
6. **Prometheus metrics** (Đẩy chỉ số Jenkins về Prometheus).

#### 6.3. Cấu hình Công cụ (Global Tool Configuration)
Đi tới **Manage Jenkins** -> **Tools**:
* **JDK**: Đặt tên `jdk21` -> Cấu hình tự động cài đặt từ `adoptium.net` (bản JDK 21).
* **NodeJS**: Đặt tên `node16` -> Tự động cài đặt bản `16.20.2` (hoặc NodeJS 18).
* **SonarQube Scanner**: Đặt tên `sonar-scanner` -> Tự động cài từ Maven.
* **Dependency-Check**: Đặt tên `DP-Check` -> Tự động cài từ Github.
* *Lưu ý quan trọng:* **KHÔNG** thêm Docker trong phần cài đặt công cụ tự động của Jenkins, pipeline sẽ dùng trực tiếp Docker cài sẵn trên Host máy ảo để tránh xung đột API.

---

### Bước 7: Cấu Hình Tích Hợp SonarQube & Docker Hub

#### 7.1. SonarQube Webhook & Token
1. Đăng nhập SonarQube (`http://<IP_MÁY_CHỦ>:9000`).
2. Vào **My Account** -> **Security** -> Tạo token mới với tên `jenkins-token` -> Copy token này.
3. Tạo Webhook báo kết quả về Jenkins: Vào **Administration** -> **Configuration** -> **Webhooks** -> Tạo webhook mới:
   * **Name**: `jenkins-webhook`
   * **URL**: `http://<IP_MÁY_CHỦ_JENKINS>:8080/sonarqube-webhook/`

#### 7.2. Lưu thông tin đăng nhập trong Jenkins (Credentials)
Vào **Manage Jenkins** -> **Credentials** -> **System** -> **Global credentials (unrestricted)** -> **Add Credentials**:
1. **SonarQube Token**:
   * **Kind**: `Secret text`
   * **Secret**: Dán Token của SonarQube vừa copy.
   * **ID**: `Sonar-token`
2. **Docker Hub Access Token** *(Tạo Personal Access Token trên Docker Hub trước)*:
   * **Kind**: `Username with password`
   * **Username**: Nhập Username Docker Hub (ví dụ `qitune`).
   * **Password**: Nhập Access Token đã tạo trên Docker Hub.
   * **ID**: `docker`

#### 7.3. Đăng ký Server SonarQube trong Jenkins System
Vào **Manage Jenkins** -> **System** -> **SonarQube servers**:
* Tích chọn **Environment variables**.
* Nhấp **Add SonarQube** -> Đặt tên: `sonar-server`.
* **Server URL**: `http://localhost:9000`.
* **Server authentication token**: Chọn Credential `Sonar-token`.
* Nhấn **Save**.

---

### Bước 8: Thiết Lập Kubernetes (K3s) Cục Bộ

Để triển khai ứng dụng lên Kubernetes (K8s) dễ dàng và nhẹ nhàng nhất trên 1 node EC2, chúng ta sử dụng **K3s**:

1. **Cài đặt K3s:**
   ```bash
   curl -sfL https://get.k3s.io | sh -
   
   # Kiểm tra xem cụm đã chạy chưa
   sudo kubectl get nodes
   ```

2. **Cấu hình phân quyền truy cập K8s cho Jenkins:**
   Để Jenkins có thể chạy lệnh `kubectl` để deploy ứng dụng, copy cấu hình config K3s sang thư mục làm việc của Jenkins:
   ```bash
   sudo mkdir -p /var/lib/jenkins/.kube
   sudo cp /etc/rancher/k3s/k3s.yaml /var/lib/jenkins/.kube/config
   sudo chown -R jenkins:jenkins /var/lib/jenkins/.kube
   ```

---

### Bước 9: Thiết Kế Quy Trình CI/CD (Jenkinsfile)

Đây là quy trình pipeline hoàn chỉnh được viết trong `Jenkinsfile` để thực hiện toàn bộ quy trình DevSecOps:

```groovy
pipeline {
    agent any

    tools {
        jdk 'jdk21'
        nodejs 'node16'
    }

    environment {
        SCANNER_HOME = tool 'sonar-scanner'
        DOCKER_IMAGE = 'qitune/neflix'
        DOCKER_CREDENTIALS_ID = 'docker'
        KUBECONFIG = '/var/lib/jenkins/.kube/config' // Chỉ định file config K3s cho Jenkins
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
                // Sử dụng catchError đề phòng NVD API bị rate limit (lỗi 429) làm pipeline bị dừng đột ngột
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
                    // Sử dụng Docker client của host bằng việc không khai báo toolName
                    withDockerRegistry(credentialsId: DOCKER_CREDENTIALS_ID){
                        sh "docker build -t neflix ."
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
        stage("Deploy to Kubernetes") {
            steps{
                sh "kubectl apply -f k8s/deployment.yml"
                sh "kubectl apply -f k8s/service.yml"
                sh "kubectl rollout restart deployment/neflix-deployment"
            }
        }
    }
}
```

---

### Bước 10: Chạy thử và Kiểm tra Kết Quả

1. Lên Jenkins > **New Item** > Đặt tên: `Netflix-DevSecOps` > Chọn **Pipeline**.
2. Tại phần **Pipeline Definition**, chọn **Pipeline script from SCM** > SCM: **Git** > Điền Git repository URL.
3. Nhấn **Save** và bấm **Build Now**.
4. Truy cập ứng dụng chạy thực tế trên Kubernetes thông qua cổng NodePort đã cấu hình:
   👉 **`http://<IP_MÁY_CHỦ>:30007`**

---

## 🛠️ Hướng Dẫn Giải Quyết Một Số Lỗi Thường Gặp (Troubleshooting)

### 1. Lỗi đầy ổ cứng máy ảo (`No space left on device`)
* **Dấu hiệu:** Các tác vụ SonarQube hoặc Docker build báo lỗi không ghi được file hoặc đĩa đầy.
* **Nguyên nhân:** Mặc định đĩa cứng của EC2 instance khi tạo mới chỉ là 8GB, quá nhỏ để chạy Jenkins và SonarQube cùng lúc.
* **Cách sửa:**
  1. Vào EC2 Console > Volumes > Resize ổ đĩa máy ảo hiện tại lên **30GB**.
  2. SSH vào máy ảo, chạy lệnh kiểm tra phân vùng: `lsblk`.
  3. Mở rộng phân vùng phần cứng:
     ```bash
     sudo growpart /dev/nvme0n1 1  # Hoặc /dev/xvda 1 tuỳ tên ổ đĩa
     ```
  4. Mở rộng hệ thống tệp tin:
     ```bash
     sudo resize2fs /dev/nvme0n1p1 # Hoặc /dev/xvda1
     ```
  5. Gõ `df -h` kiểm tra xem phân vùng `/` đã lên ~29GB chưa.

### 2. Lỗi phiên bản Docker client quá cũ (`API version 1.29 is too old`)
* **Dấu hiệu:** Stage Docker build & push thất bại ngay tại bước login, báo lỗi API tối thiểu hỗ trợ là 1.44 nhưng client gửi lên chỉ là 1.29.
* **Nguyên nhân:** Đang khai báo cấu hình cài đặt tự động Docker trong Jenkins Tools (nó tự tải bản client cực kỳ cũ từ get.docker.com).
* **Cách sửa:** Trong file `Jenkinsfile`, bỏ tham số `toolName: 'docker'` trong lệnh `withDockerRegistry` để bắt Jenkins sử dụng công cụ Docker có sẵn của Host Ubuntu.

### 3. Lỗi cập nhật cơ sở dữ liệu lỗ hổng bảo mật NVD (lỗi 429) ở OWASP Scan
* **Dấu hiệu:** Stage `OWASP FS SCAN` chạy rất lâu và kết thúc bằng lỗi 429 (Too many requests) do NVD chặn lượt tải khi không có API key.
* **Cách sửa:** Bao bọc lệnh chạy `dependencyCheck` trong khối `catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE')` trong `Jenkinsfile` để Jenkins bỏ qua và tiếp tục chạy các stage sau nếu NVD API bị lỗi.

### 4. Lỗi đặt tên Kubernetes Service (`DNS-1035 label must consist of lowercase...`)
* **Dấu hiệu:** Deploy lên Kubernetes thất bại ở bước `service.yml` với lỗi báo tên Service không hợp lệ.
* **Nguyên nhân:** Kubernetes quy định tên của các tài nguyên chỉ được phép dùng chữ viết thường, số và dấu gạch ngang `-`. Đặt tên có chữ viết hoa (ví dụ: `neflix-Service`).
* **Cách sửa:** Sửa lại file `k8s/service.yml`, đổi tên sang chữ thường hoàn toàn (ví dụ: `neflix-service`).

---

## 🛑 Hướng Dẫn Tạm Dừng & Khởi Động Lại Hệ Thống Để Tránh Mất Phí AWS

Nếu sử dụng AWS free tier thì việc tắt các dịch vụ và máy ảo AWS là cực kỳ quan trọng để bảo toàn tài khoản (đặc biệt khi chạy loại máy ảo lớn như `t2.large` hay `m7i-flex.large` nằm ngoài hạn mức 750h miễn phí của `t2.micro`).

### 1. Lệnh tắt toàn bộ các dịch vụ trên máy ảo (Chạy bằng SSH):
Chạy các lệnh sau để dừng tất cả các container, cụm K8s, Jenkins và bộ công cụ giám sát:

```bash
# Dừng container chạy thử và SonarQube
docker stop neflix-app || true
docker stop sonar

# Dừng cụm Kubernetes (K3s) (tự động tắt toàn bộ Pods của ứng dụng)
sudo systemctl stop k3s

# Dừng Jenkins
sudo systemctl stop jenkins

# Dừng Prometheus, Node Exporter và Grafana
sudo systemctl stop prometheus
sudo systemctl stop node_exporter
sudo systemctl stop grafana-server
```

Sau khi chạy xong, hãy lên **AWS Console > EC2 > Instances** > Chọn máy ảo `Netflix-DevSecOps` và chọn **Instance state > Stop instance** để dừng tính phí chạy máy ảo.

---

### 2. Lệnh khởi động lại toàn bộ hệ thống để làm tiếp:
Khi bật lại máy ảo AWS, hãy SSH vào và khởi động lại các dịch vụ bằng các lệnh sau:

```bash
# Khởi động lại SonarQube
docker start sonar

# Khởi động lại Kubernetes (K3s) (K8s sẽ tự động kéo lại các Pod ứng dụng lên)
sudo systemctl start k3s

# Khởi động lại Jenkins
sudo systemctl start jenkins

# Khởi động lại hệ thống giám sát
sudo systemctl start prometheus
sudo systemctl start node_exporter
sudo systemctl start grafana-server
```
