# Runbook — UTM + hai Linux VM trên Mac

Runbook ngày 06/11/2026, phục vụ [N01–N06](02-native-simulation.md). **Chưa provision/chưa boot VM** ở thời điểm viết: Mac M2 Pro/16 GiB chỉ có khoảng 4,4 GiB disk khả dụng, UTM chưa cài. [Preflight thực](../../implementation/evidence/bv01-native-simulation/utm-host-preflight-2026-11-06.json). Không copy các lệnh dưới thành bằng chứng đã chạy.

## 1. Host và storage

Từ Mac, kiểm lại trước download:

```sh
sysctl hw.memsize hw.ncpu
sw_vers
df -h .
ls /Volumes
```

Resource budget của dự án: volume lưu VM có ≥120 GiB khả dụng; ổ hệ thống macOS giữ ≥20 GiB trống, kể cả khi VM trên SSD ngoài. Đặt ISO, VM và build caches vào volume đã chọn, ngoài Git. Không dựa vào sparse disk 64 GiB để kết luận chỉ cần vài GiB free. Không xóa caches/files người dùng khi chưa được chỉ định.

| VM | CPU | RAM | Virtual disk | Chế độ |
|---|---:|---:|---:|---|
| `mekoniq-amr` | 4 | 8 GiB | 64 GiB | Ubuntu24.04 ARM64, headless simulator |
| `mekoniq-arm` | 2 | 4 GiB | 32 GiB | Debian12 ARM64, desktop QtVCP |

Trên host16 GiB chạy luân phiên để provision/qualify riêng. Combined là bài resource qualification sau cùng, không auto-start cả hai khi login. Thử budget6+3 GiB chỉ sau dừng workload development nặng do task sở hữu; đo memory pressure/swap/telemetry. Nếu không đạt, cần host đủ tài nguyên; replay hai lượt riêng không phải combined.

## 2. Cài UTM và chọn image

Sau storage gate, tải bản stable từ [UTM official installation](https://docs.getutm.app/installation/macos/) và cài app. Không chọn beta chỉ để có API mới. Bản GitHub miễn phí; không cần mua App Store. Kiểm app và ghi version:

```sh
codesign --verify --deep --strict /Applications/UTM.app
spctl --assess --type execute /Applications/UTM.app
/Applications/UTM.app/Contents/MacOS/utmctl version
/Applications/UTM.app/Contents/MacOS/utmctl help
```

Nếu macOS cần quyền Automation cho Terminal/UTM, đó là bước tương tác hệ điều hành; không sửa TCC database hay bỏ Gatekeeper. Sử dụng CLI đúng bản cài. `utmctl` quản lý VM; tạo VM bằng UI/AppleScript theo [UTM scripting](https://docs.getutm.app/scripting/scripting/), không giả định có subcommand create.

Image sources:

- Ubuntu: [official 24.04 ARM64 images](https://cdimage.ubuntu.com/releases/24.04/release/), chọn **live-server-arm64 ISO**, không Raspberry Pi preinstalled image. Resolve point release hiện có, ghi filename/URL/checksum vào N01 inventory.
- Debian: [official archived releases](https://cdimage.debian.org/cdimage/archive/), chọn Debian **12.x Bookworm arm64 netinst**, không image mặc định Debian13 hoặc Pi. Dùng lightweight desktop XFCE cho QtVCP.

Kiểm signature của checksum list theo hướng dẫn distributor và so sha256 ISO; pin exact image sau kiểm. Không điền checksum đoán hoặc null vào lock verified. File ISO lớn chưa được tải trong đợt preflight này.

UTM: Create → Virtualize Linux; chọn QEMU backend với aarch64/hypervisor enabled, UEFI, virtio disk/network, không emulation x86. Chọn Shared/NAT network để guest ra internet và host SSH tới guest; kiểm inter-VM reachability trước N04. Không bridged vào mạng robot. Không USB passthrough. Dùng virtio display cho Debian; Ubuntu có serial/console để install rồi chạy server. Lưu VM bundle đúng volume đã chọn.

Nếu UI khác do phiên bản UTM, kiểm architecture/hypervisor/network từ config thực; không chỉ dựa tên “Linux”. Sau install eject ISO, reboot, tạo powered-off backup baseline. Không snapshot active LinuxCNC motion/journal để dùng như checkpoint application.

## 3. Guest baseline và chuyển source

Trong mỗi guest mới:

```sh
sudo apt-get update
sudo apt-get install openssh-server ca-certificates git build-essential python3-venv python3-pip
sudo systemctl enable --now ssh
uname -m
dpkg --print-architecture
cat /etc/os-release
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Debian GUI có thể cài XFCE qua installer. QEMU guest agent và SPICE guest tools theo [UTM Linux support](https://docs.getutm.app/guest-support/linux/); không share toàn bộ home Mac. Chỉ copy clean source snapshot/committed checkout; không copy macOS node_modules hoặc Python venv sang Linux.

SSH key tạo riêng cho lab, private key chỉ ở máy khởi tạo. So fingerprint bằng console UTM trước lưu known_hosts; không dùng StrictHostKeyChecking=no. Gán alias `mekoniq-amr` và `mekoniq-arm` trong SSH config của operator sau khi biết IP guest. Không mặc định IP từ ví dụ tài liệu.

Cài Node24.22.2 Linux ARM64 từ Node distribution, xác minh checksum; pnpm10.32.1. Ghi versions. Trong clean source checkout:

```sh
node --version
pnpm --version
pnpm install --frozen-lockfile
python3 -m venv --system-site-packages .venv
.venv/bin/pip install -r robotics/simulation/requirements-dev.txt
```

Venv system-site-packages để truy cập ROS/LinuxCNC modules do apt cung cấp. Python Ubuntu và Debian có thể khác; không ép Python3.12 venv đọc LinuxCNC binding build cho3.11. Ghi resolved Python/dependency versions theo từng guest; compatibility phải được chạy, không suy từ tests macOS.

## 4. Ubuntu — ROS/Gazebo/Nav2

Thiết lập ROS2 apt repository theo [official Jazzy Ubuntu installation](https://docs.ros.org/en/jazzy/Installation/Ubuntu-Install-Debs.html), đúng Noble/arm64 và signed keyring. Giữ [Jazzy/Harmonic supported pairing](https://gazebosim.org/docs/harmonic/ros_installation/). Ưu tiên ros-jazzy-ros-gz vendor packages như Dockerfile repository; không trộn thêm Gazebo classic hoặc rolling.

Sau repository setup, xem candidate trước khi install:

```sh
apt-cache policy ros-jazzy-ros-base ros-jazzy-navigation2 ros-jazzy-ros-gz-sim
sudo apt-get install ros-jazzy-ros-base ros-dev-tools ros-jazzy-navigation2 ros-jazzy-nav2-bringup ros-jazzy-ros-gz-sim ros-jazzy-ros-gz-bridge ros-jazzy-xacro ros-jazzy-robot-state-publisher ros-jazzy-launch-testing-ament-cmake ros-jazzy-ament-lint-auto
```

Package candidate thiếu arm64 → blocked dependency, không thay library major ngẫu nhiên. Trong source checkout, shell bash:

```sh
source /opt/ros/jazzy/setup.bash
colcon build --base-paths robotics/description robotics/navigation robotics/simulation --packages-select mekoniq_description mekoniq_navigation mekoniq_simulation
source install/setup.bash
export PATH="$PWD/.venv/bin:$PATH"
export PYTHONPATH="$PWD/robotics/simulation:$PWD/robotics/agent${PYTHONPATH:+:$PYTHONPATH}"
export MEKONIQ_CONTRACTS_DIR="$PWD/packages/contracts/schemas"
node scripts/lab-sil.mjs doctor --backend gazebo_nav2 --json
```

Doctor hiện tại còn gắn image.lock.json baseline; không dùng nó làm chứng cứ image ARM64. N02 bổ sung environment-profile và thực inventory trước qualification. Sau N02 chạy FD01 rồi FD02/03/04/07 theo command trong plan. `headless` không có window vẫn cần renderer nếu fixture dùng GPU sensors; kiểm real sensor output/EGL/software renderer và lưu logs. Nếu thiếu rendering, giữ failed/not_run đúng giai đoạn; không xóa lidar/contact từ fixture.

## 5. Debian — LinuxCNC SIM/QtVCP

Theo [official LinuxCNC install](https://linuxcnc.org/docs/html/getting-started/getting-linuxcnc.html), resolve bookworm arm64 package. Không cần realtime kernel cho SIM; không install EtherCAT/drives hoặc tự chuyển machine-control profile.

```sh
apt-cache policy linuxcnc-uspace python3-pyqt5 python3-pyqt5.qsci
sudo apt-get -s install linuxcnc-uspace python3-pyqt5 python3-pyqt5.qsci python3-opengl
sudo apt-get install linuxcnc-uspace python3-pyqt5 python3-pyqt5.qsci python3-opengl
python3 -c 'import linuxcnc; from PyQt5 import QtWidgets, Qsci; print("controller and Qt modules importable")'
linuxcnc --version
```

Nếu distro candidate không đủ QtVCP/PUMA features, resolve official LinuxCNC repo matching Bookworm ARM64 và pin version trước tiếp tục; không cài deb Pi/amd64 vì cùng tên. Apt simulation output phải được review, không purge/reinstall system packages mù. Dependencies lock chỉ chuyển verified sau N03.

Từ source root, activate `.venv`, chuyển vào arm-controller để không import nhầm ROS bridge:

```sh
cd integrations/arm-controller
../../.venv/bin/python -m pytest tests/test_arbiter.py tests/test_bridge_recovery.py -q
bash scripts/smoke-sim.sh --profile configs/sim/puma560/mekoniq.ini --evidence-dir /var/tmp/mekoniq-evidence/controller-terminal
linuxcnc configs/sim/puma560/mekoniq.ini
```

Lệnh cuối mở GUI trên desktop guest. Thực hiện [HMI acceptance hiện có](../../../../source/integrations/arm-controller/docs/hmi-acceptance.md) qua đúng path workspace; nếu checkout tách, đọc file `integrations/arm-controller/docs/hmi-acceptance.md` trong source. Capture actual actions/joints/epochs, không kết luận pass chỉ từ GUI screenshot.

## 6. Chạy luân phiên và integrated topology

Từ Mac, sau khi VM tồn tại:

```sh
/Applications/UTM.app/Contents/MacOS/utmctl list
/Applications/UTM.app/Contents/MacOS/utmctl start mekoniq-arm
```

Shutdown từ guest `sudo shutdown -h now` khi không có run active; kiểm UTM state stopped trước mở VM khác. Không force-stop để tiết kiệm RAM giữa transfer; nếu cần kiểm fault đó phải journal đúng fault/test run.

Sau N04, coordinator ở Ubuntu mở tunnel tới Debian. Profile arm socket actual `/run/mekoniq-arm/bridge.sock`; local operator socket **không forward**. SSH alias cho connection này dùng principal chỉ thuộc `mekoniq-lab`, không dùng tài khoản admin provision VM. Command mẫu chạy trong Ubuntu, local directory do coordinator tạo mode0700 và chưa có socket:

```sh
ssh -N -a -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=yes -o ServerAliveInterval=5 -o ServerAliveCountMax=3 -L /run/user/1000/mekoniq-bv01/arm.sock:/run/mekoniq-arm/bridge.sock mekoniq-arm-lab
```

UID1000 chỉ là ví dụ, supervisor N04 resolve runtime directory thực. Cấu hình group/ACL dựa [bridge deployment](../../../../source/integrations/arm-controller/docs/bridge-deployment.md); không chmod777 socket. Không cho browser nhập arbitrary SSH host/path. `ExitOnForwardFailure` chỉ chứng minh local forward bind; vẫn cần adapter handshake và live controller status.

Mac browser truy cập UI phục vụ **trong Ubuntu** qua SSH loopback, giữ cùng origin4175; forward4176 chỉ khi transport browser hiện có yêu cầu runtime trực tiếp, mặc định tận dụng proxy cùng origin:

```sh
ssh -N -a -o ExitOnForwardFailure=yes -L 127.0.0.1:4175:127.0.0.1:4175 mekoniq-amr
```

Nếu4175 đang dùng, báo conflict và dừng launcher task-owned đúng cách, không kill tiến trình lạ. Runtime gateway/native UI lifecycle là N06 deliverable; hiện tại launcher `lab:mock` không tự biến thành native. Không mở port1880/1884, không forward operator socket. Dùng console VM cho QtVCP; không cần public VNC.

## 7. Kết thúc và evidence

Mỗi test lưu source/lab/runtime/profile/model revisions, exact command, UTC, architecture, package inventory, exit code/assertions, logs checksum. Native engine chạy trong ARM64 VM → software native evidence trên ARM64; grip vẫn modeled. `doctor`pass không phải scenario pass; CONTROLLER-POC chưa phải R-SIM. Combined phải có cùng runId và hai engine sống cùng thời điểm.

Stop coordinator/tunnel do task tạo, chờ journal flush rồi shutdown guest. Copy metadata/log bundle về Lab evidence store; kiểm hash. Không commit VM disks, downloaded ISO, SSH keys hoặc pairing tokens. Disk thiếu hiện tại giữ `blocked_external/not_run`, chỉ tiếp tục provisioning khi storage gate được giải quyết.

## Implemented qualification helpers

From workspace root under Node24, run `node source/scripts/native-sim/host-preflight.mjs --vm-root /absolute/existing/volume`. Exit2 records blockers; it never installs UTM or downloads an image. If VM and macOS share a filesystem, the preflight requires140GiB free (120GiB VM budget plus20GiB system reserve); separate storage still requires both independent budgets. On16GiB default to sequential VMs.

The Debian smoke supports `--dependencies-lock packaging/dependencies.arm64-vm.lock.json`. This candidate is separate from amd64 and remains unverified. It records `runtime-inventory.json` with actual installed packages and resolved binaries/modules, and refuses an architecture mismatch. Current host executions are in `N03-terminal/`; they exit2/not_run because LinuxCNC/Linux are absent. No GUI acceptance was performed.
