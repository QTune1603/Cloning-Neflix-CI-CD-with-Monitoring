# Dự Án DevSecOps: Triển Khai Netflix Clone Với Jenkins, Docker, Kubernetes & Hệ Thống Giám Sát (Prometheus + Grafana)

Dự án này hướng dẫn bạn cách xây dựng một quy trình **DevSecOps CI/CD chuyên nghiệp** từ đầu để kiểm tra, quét bảo mật, đóng gói và triển khai ứng dụng **Netflix Clone (React + Vite)**. Ngoài ra, chúng ta cũng sẽ thiết lập hệ thống giám sát thời gian thực cho máy chủ và Jenkins bằng bộ đôi **Prometheus & Grafana**.

---

## 🏗️ Kiến Trúc Hệ Thống & Các Công Cụ Sử Dụng

*   **Frontend**: React (Vite) - Giao diện Netflix Clone tối giản nhưng hiện đại và mượt mà.
*   **CI/CD Pipeline**: Jenkins.
*   **Bảo mật & Quét lỗi (DevSecOps)**:
    *   **SonarQube**: Quét chất lượng code (Code Quality) và lỗ hổng bảo mật tĩnh (SAST).
    *   **OWASP Dependency-Check**: Quét các thư viện phụ thuộc (dependencies) xem có lỗ hổng bảo mật nào đã được công bố (CVE) hay không.
    *   **Trivy**: Quét bảo mật hệ thống tệp tin dự án (Filesystem Scan) và quét Docker Image (Image Scan).
*   **Đóng gói**: Docker (Multi-stage build tối ưu kích thước ảnh, chạy bằng Nginx Alpine).
*   **Triển khai**: Docker Container / Kubernetes Cluster (K8s).
*   **Giám sát (Monitoring)**: Prometheus, Node Exporter, và Grafana.

---

## 🖥️ Chuẩn Bị Tài Nguyên Máy Chủ trên AWS

Do chúng ta chạy rất nhiều dịch vụ nặng cùng một lúc (Jenkins, SonarQube, Prometheus, Grafana, Docker), máy ảo `t2.micro` từ Lab trước sẽ không thể đáp ứng nổi và sẽ bị treo ngay lập tức. 

> [!IMPORTANT]
> **Yêu cầu cấu hình tối thiểu:**
> *   **Hệ điều hành**: Ubuntu 22.04 LTS
> *   **Instance Type**: `t2.large` (2 vCPUs, 8GB RAM)
> *   **Ổ cứng (Storage)**: Tối thiểu 30GB gp3 SSD

### Cấu hình Security Group (Inbound Rules)
Hãy cấu hình Security Group trên AWS EC2 để mở các cổng sau:

| Port | Dịch Vụ / Công Cụ | Ghi Chú |
| :--- | :--- | :--- |
| `22` | SSH | Quản trị máy chủ |
| `8080` | Jenkins | Giao diện Jenkins |
| `9000` | SonarQube | Giao diện SonarQube |
| `9090` | Prometheus | Hệ thống thu thập metrics |
| `9100` | Node Exporter | Thu thập chỉ số tài nguyên phần cứng máy chủ |
| `3000` | Grafana | Giao diện hiển thị Dashboard giám sát |
| `8081` | Docker App | Cổng truy cập ứng dụng Netflix Clone chạy trên Docker |
| `30007` | Kubernetes App | NodePort để truy cập ứng dụng trên K8s Cluster |

---

## 🛠️ Hướng Dẫn Cài Đặt Chi Tiết Từng Bước

### Bước 1: Thiết Lập Swap Space (Bộ Nhớ Ảo)
Để đảm bảo máy chủ không bị sập nguồn khi chạy các tác vụ biên dịch nặng, hãy tạo thêm 4GB Swap:

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

### Bước 2: Cài Đặt Docker, Jenkins & Trivy

Tạo một script cài đặt tự động `setup.sh`:

```bash
nano setup.sh
```

Dán nội dung sau vào file `setup.sh`:

```bash
#!/bin/bash
sudo apt update -y

# 1. Cài đặt Java 17 (Cần thiết cho Jenkins)
wget -O - https://packages.adoptium.net/artifactory/api/gpg/key/public | sudo tee /etc/apt/keyrings/adoptium.asc
echo "deb [signed-by=/etc/apt/keyrings/adoptium.asc] https://packages.adoptium.net/artifactory/deb $(awk -F= '/^VERSION_CODENAME/{print$2}' /etc/os-release) main" | sudo tee /etc/apt/sources.list.d/adoptium.list
sudo apt update -y
sudo apt install temurin-17-jdk -y
java --version

# 2. Cài đặt Jenkins
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://packages.adoptium.net/debian-stable binary/ | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt-get update -y
sudo apt-get install jenkins -y
sudo systemctl start jenkins
sudo systemctl enable jenkins

# 3. Cài đặt Docker
sudo apt-get install docker.io -y
sudo usermod -aG docker $USER
sudo chmod 667 /var/run/docker.sock

# 4. Cài đặt Trivy (Quét lỗ hổng bảo mật)
sudo apt-get install wget apt-transport-https gnupg lsb-release -y
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor | sudo tee /usr/share/keyrings/trivy.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
sudo apt-get update
sudo apt-get install trivy -y
```

Cấp quyền thực thi và chạy script:

```bash
chmod +x setup.sh
./setup.sh
```

Khởi động lại session SSH (hoặc chạy lệnh `newgrp docker`) để áp dụng quyền Docker mà không cần sudo.

---

### Bước 3: Chạy SonarQube Bằng Docker

Chúng ta sẽ sử dụng Docker để chạy nhanh một phiên bản SonarQube LTS:

```bash
docker run -d --name sonar -p 9000:9000 sonarqube:lts-community
```

Đợi khoảng 1-2 phút cho SonarQube khởi động hoàn tất. Truy cập vào `http://<IP_MÁY_CHỦ>:9000` (Tài khoản mặc định: `admin` / `admin`. Hệ thống sẽ bắt buộc đổi mật khẩu mới trong lần đầu đăng nhập).

---

### Bước 4: Thiết Lập Hệ Thống Giám Sát (Prometheus & Node Exporter)

#### 4.1. Cài đặt Prometheus
Tạo tài khoản hệ thống cho Prometheus để đảm bảo bảo mật:
```bash
sudo useradd --system --no-create-home --shell /bin/false prometheus
```

Tải xuống bản cài đặt Prometheus:
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

Tạo Service Systemd cho Prometheus để tự động khởi chạy cùng máy chủ:
```bash
sudo nano /etc/systemd/system/prometheus.service
```

Thêm cấu hình sau:
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

Kích hoạt và khởi chạy dịch vụ:
```bash
sudo systemctl daemon-reload
sudo systemctl enable prometheus
sudo systemctl start prometheus
```

#### 4.2. Cài đặt Node Exporter (Để giám sát tài nguyên máy chủ Linux)
Tạo tài khoản hệ thống cho Node Exporter:
```bash
sudo useradd --system --no-create-home --shell /bin/false node_exporter
```

Tải xuống và cài đặt Node Exporter:
```bash
wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
tar -xvf node_exporter-1.6.1.linux-amd64.tar.gz
sudo mv node_exporter-1.6.1.linux-amd64/node_exporter /usr/local/bin/
rm -rf node_exporter-1.6.1.linux-amd64*
```

Tạo Service Systemd cho Node Exporter:
```bash
sudo nano /etc/systemd/system/node_exporter.service
```

Thêm cấu hình sau:
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

Khởi chạy Node Exporter:
```bash
sudo systemctl daemon-reload
sudo systemctl enable node_exporter
sudo systemctl start node_exporter
```

#### 4.3. Đăng ký Node Exporter vào Prometheus
Mở file cấu hình Prometheus:
```bash
sudo nano /etc/prometheus/prometheus.yml
```

Thêm job `node_exporter` vào phần `scrape_configs`:
```yaml
  - job_name: 'node_exporter'
    static_configs:
      - targets: ['localhost:9100']
```

Kiểm tra cú pháp cấu hình có chuẩn hay không:
```bash
promtool check config /etc/prometheus/prometheus.yml
```

Nếu cấu hình chính xác, tải lại cấu hình mà không cần restart service:
```bash
curl -X POST http://localhost:9090/-/reload
```

---

### Bước 5: Cài Đặt & Cấu Hình Grafana

#### 5.1. Cài đặt Grafana
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

#### 5.2. Đăng nhập và cấu hình Dashboard trên Grafana
1.  Truy cập vào `http://<IP_MÁY_CHỦ>:3000` (Tài khoản mặc định: `admin` / `admin`, đổi mật khẩu ở lần đăng nhập đầu).
2.  **Thêm Data Source**:
    *   Đi tới **Connections** -> **Data sources** -> Chọn **Add data source**.
    *   Chọn **Prometheus**.
    *   Tại trường **Connection URL**, điền: `http://localhost:9090`.
    *   Cuộn xuống cuối và nhấn **Save & test**. Bạn sẽ thấy thông báo màu xanh báo kết nối thành công.
3.  **Import Dashboard Giám sát tài nguyên máy chủ**:
    *   Đi tới biểu tượng dấu cộng `+` ở góc phải trên cùng hoặc menu trái -> **Dashboards** -> Chọn **Import**.
    *   Tại mục **Import via grafana.com**, nhập ID Dashboard: `1860`.
    *   Nhấp **Load**.
    *   Chọn Data source Prometheus vừa thêm và nhấn **Import**. Bạn sẽ nhận được biểu đồ tuyệt đẹp hiển thị chi tiết chỉ số CPU, RAM, Disk I/O của máy chủ.

---

### Bước 6: Cấu Hình Jenkins & Tích Hợp Các Plugins Quét Bảo Mật

#### 6.1. Mở khóa Jenkins lần đầu
Truy cập `http://<IP_MÁY_CHỦ>:8080`.
Lấy mật khẩu admin ban đầu:
```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```
Dán mật khẩu vào trang web, chọn **Install suggested plugins** và tiến hành tạo tài khoản admin đầu tiên.

#### 6.2. Cài đặt các plugin cần thiết
Đi tới **Manage Jenkins** -> **Plugins** -> **Available Plugins**, tìm và tích chọn cài đặt các plugin sau:
1.  **Eclipse Temurin Installer** (Cấu hình cài đặt phiên bản Java trong pipeline).
2.  **SonarQube Scanner** (Liên kết với SonarQube server quét tĩnh bảo mật code).
3.  **NodeJS** (Tải thư viện NPM & build sản phẩm React).
4.  **OWASP Dependency-Check** (Quét thư viện dependencies bên thứ ba).
5.  **Docker Pipeline** (Hỗ trợ viết lệnh build & push Docker image trong Jenkinsfile).
6.  **Email Extension** (Gửi báo cáo lỗi và log file quét lỗi về Email cá nhân).
7.  **Prometheus metrics** (Đẩy metrics hoạt động của Jenkins về Prometheus để giám sát).

*Sau khi chọn, nhấn nút **Install**.*

#### 6.3. Giám sát hệ thống Jenkins bằng Prometheus
Sau khi cài đặt xong plugin **Prometheus metrics**:
1.  Đăng ký Jenkins thành một đích quét trong cấu hình Prometheus:
    ```bash
    sudo nano /etc/prometheus/prometheus.yml
    ```
2.  Thêm cấu hình sau vào phần `scrape_configs`:
    ```yaml
      - job_name: 'jenkins'
        metrics_path: '/prometheus/'
        static_configs:
          - targets: ['localhost:8080']
    ```
3.  Tải lại cấu hình Prometheus:
    ```bash
    curl -X POST http://localhost:9090/-/reload
    ```
4.  **Import Dashboard Jenkins trong Grafana**:
    *   Vào Grafana -> **Import Dashboard** -> Sử dụng ID: `9964`.
    *   Chọn Data source Prometheus và nhấn **Import**. Giờ đây bạn đã có thể xem chi tiết số lượng jobs, hàng đợi, tỉ lệ build thành công/thất bại của Jenkins ngay trên Grafana.

---

### Bước 7: Cấu Hình Các Công Cụ Trong Jenkins Tools

Đi tới **Manage Jenkins** -> **Tools**:

1.  **JDK Installations**:
    *   Nhấn **Add JDK** -> Đặt tên: `jdk17`.
    *   Tích chọn *Install automatically* -> Chọn *Install from adoptium.net* -> Chọn phiên bản `jdk-17.0.8.1+1` (hoặc bản mới nhất thuộc dòng 17).
2.  **NodeJS Installations**:
    *   Nhấn **Add NodeJS** -> Đặt tên: `node16`.
    *   Tích chọn *Install automatically* -> Chọn phiên bản `NodeJS 16.20.2`.
3.  **SonarQube Scanner Installations**:
    *   Nhấn **Add SonarQube Scanner** -> Đặt tên: `sonar-scanner`.
    *   Tích chọn *Install automatically* -> Chọn phiên bản mới nhất từ Maven Central.
4.  **Dependency-Check Installations**:
    *   Nhấn **Add Dependency-Check** -> Đặt tên: `DP-Check`.
    *   Tích chọn *Install automatically* -> Chọn phiên bản mới nhất từ Github.
5.  **Docker Installations**:
    *   Nhấn **Add Docker** -> Đặt tên: `docker`.
    *   Tích chọn *Install automatically* -> Chọn phiên bản mới nhất từ docker.com.

*Nhấn **Apply** và **Save**.*

---

### Bước 8: Tích Hợp SonarQube và DockerHub Với Jenkins Credentials

#### 8.1. Thiết lập SonarQube Webhook & Token
1.  Truy cập SonarQube (`http://<IP_MÁY_CHỦ>:9000`).
2.  Tạo Token kết nối cho Jenkins:
    *   Nhấp vào biểu tượng tài khoản của bạn ở góc phải -> **My Account** -> **Security** -> Nhập tên token (ví dụ: `jenkins-token`) -> Nhấp **Generate**.
    *   **Sao chép Token này lại**.
3.  Tạo Webhook để báo kết quả Quality Gate ngược về Jenkins:
    *   Vào **Administration** -> **Configuration** -> **Webhooks** -> Nhấp **Create**.
    *   Đặt tên: `jenkins-webhook`.
    *   URL: `http://<IP_MÁY_CHỦ_JENKINS>:8080/sonarqube-webhook/`.
    *   Nhấp **Create**.

#### 8.2. Lưu trữ Token trong Jenkins Credentials
1.  Truy cập Jenkins -> **Manage Jenkins** -> **Credentials** -> **System** -> **Global credentials (unrestricted)** -> Nhấp **Add Credentials**.
2.  **Thêm SonarQube Token**:
    *   **Kind**: `Secret text`.
    *   **Secret**: Dán mã Token của SonarQube vừa sao chép ở trên.
    *   **ID**: `Sonar-token`.
    *   Nhấn **Create**.
3.  **Thêm tài khoản DockerHub**:
    *   **Kind**: `Username with password`.
    *   **Username**: Nhập tài khoản đăng nhập DockerHub của bạn.
    *   **Password**: Nhập mật khẩu DockerHub (hoặc Personal Access Token từ DockerHub).
    *   **ID**: `docker`.
    *   Nhấn **Create**.

#### 8.3. Đăng ký Server SonarQube trong Jenkins System
1.  Vào **Manage Jenkins** -> **System**.
2.  Tìm tới mục **SonarQube servers**:
    *   Tích chọn **Environment variables**.
    *   Nhấp **Add SonarQube** -> Đặt tên: `sonar-server`.
    *   **Server URL**: `http://localhost:9000` (Nếu chạy container cùng host).
    *   **Server authentication token**: Chọn Credential `Sonar-token` vừa tạo.
3.  Nhấn **Apply** và **Save**.

---

### Bước 9: Thiết Lập Email Thông Báo Lỗi Từ Jenkins

Để Jenkins gửi báo cáo đính kèm kết quả quét bảo mật qua Gmail:
1.  Bật xác minh 2 bước cho Gmail cá nhân của bạn.
2.  Truy cập vào trang bảo mật Google Account và tạo một **App Password** (Mật khẩu ứng dụng) dành cho Mail.
3.  Vào **Manage Jenkins** -> **System**.
4.  Cấu hình tại phần **Extended E-mail Notification**:
    *   **SMTP Server**: `smtp.gmail.com`
    *   **SMTP Port**: `465`
    *   Nhấp **Advanced** -> Chọn *Use SMTP Authentication*.
    *   **User Name**: Địa chỉ Gmail của bạn.
    *   **Password**: Mật khẩu ứng dụng (App Password) vừa tạo ở trên.
    *   Tích chọn **Use SSL**.
5.  Cuộn xuống cuối trang ở phần **E-mail Notification** và cấu hình tương tự. Bạn có thể nhấn **Test configuration** để kiểm tra gửi thư thử nghiệm.
6.  *Nhấn **Apply** và **Save**.*

---

### Bước 10: Khởi Tạo Pipeline Trên Jenkins & Chạy Thử Nghiệm

1.  Tại trang chủ Jenkins, chọn **New Item** -> Nhập tên: `Netflix-DevSecOps` -> Chọn **Pipeline** -> Nhấn **OK**.
2.  Cuộn xuống phần **Pipeline definition** -> Chọn **Pipeline script from SCM**.
3.  **SCM**: Chọn `Git`.
4.  **Repository URL**: Đường dẫn Git Repository chứa code của bạn (ví dụ: `https://github.com/<USERNAME>/Cloning-Neflix-CI-CD-with-Monitoring.git`).
5.  **Branch Specifier**: `*/main`.
6.  **Script Path**: `Jenkinsfile`.
7.  Nhấn **Save** và nhấn **Build Now** để khởi chạy quy trình tự động!

Sau khi Pipeline chạy thành công, ứng dụng Netflix Clone của bạn sẽ chạy trực tiếp trên cổng: **`http://<IP_MÁY_CHỦ>:8081`**

---

## ☸️ Bước 11: Triển Khai Lên Kubernetes (K8s) Cluster

Nếu bạn muốn nâng cấp hệ thống chạy trên môi trường có tính sẵn sàng cao, hãy triển khai dự án lên cụm Kubernetes.

### 11.1. Cài đặt Kubectl trên máy chủ Jenkins
```bash
sudo apt update
sudo apt install -y curl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

### 11.2. Khởi động các Node (Master & Worker)
Cần chuẩn bị thêm máy chủ cho cụm Kubernetes (Sử dụng Ubuntu 20.04/22.04).
*   **Trên Master Node**:
    ```bash
    sudo hostnamectl set-hostname K8s-Master
    ```
*   **Trên Worker Node**:
    ```bash
    sudo hostnamectl set-hostname K8s-Worker
    ```

### 11.3. Cài đặt các thành phần K8s (Chạy trên cả hai Node)
```bash
sudo apt-get update 
sudo apt-get install -y docker.io
sudo usermod -aG docker $USER
newgrp docker
sudo chmod 777 /var/run/docker.sock

# Thêm kho lưu trữ Kubernetes apt
sudo curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl
```

### 11.4. Thiết lập Master Node
Chạy lệnh khởi tạo cụm trên máy **Master**:
```bash
sudo kubeadm init --pod-network-cidr=10.244.0.0/16
```

Cấu hình quản trị K8s cho tài khoản user thường:
```bash
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

Cài đặt Calico hoặc Flannel Network Plugin để kết nối các Pod:
```bash
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.26.1/manifests/calico.yaml
```

### 11.5. Kết nối Worker Node vào Cluster
Tại máy **Worker Node**, hãy chạy lệnh `kubeadm join` được hiển thị ở màn hình kết thúc cài đặt của Master Node. Ví dụ:
```bash
sudo kubeadm join <IP_MASTER>:6443 --token <TOKEN> --discovery-token-ca-cert-hash sha256:<HASH>
```

### 11.6. Triển khai ứng dụng bằng file Manifest K8s
Sau khi cụm K8s sẵn sàng (kiểm tra bằng lệnh `kubectl get nodes` trên Master), ta tiến hành áp dụng các cấu hình triển khai:

```bash
# Áp dụng Deployment (Tạo Pods chạy ứng dụng)
kubectl apply -f k8s/deployment.yml

# Áp dụng Service NodePort (Mở cổng truy cập bên ngoài)
kubectl apply -f k8s/service.yml
```

Kiểm tra trạng thái triển khai:
```bash
kubectl get all
```

Giờ đây, bạn có thể truy cập ứng dụng thông qua bất kỳ IP của Node nào trong cụm với cổng đã định nghĩa: **`http://<IP_WORKER_OR_MASTER>:30007`**
