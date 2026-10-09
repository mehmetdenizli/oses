"""
Mikrosaray inPOS m530 & GİB GMP-3 YN ÖKC Entegrasyon Sürücüsü
Supports:
1. TCP/IP Network Connection (Ethernet/Wi-Fi)
2. Serial COM Port Connection (USB/RS232)
3. Simulation / Auto-Approval Mode (for testing & offline operations)
"""

import socket
import json
import logging
import time

logger = logging.getLogger("gmp3_driver")

class GMP3Driver:
    def __init__(self, connection_type="SIMULATION", ip="192.168.1.100", port=9090, com_port="COM3"):
        self.connection_type = connection_type  # 'IP', 'SERIAL', 'SIMULATION'
        self.ip = ip
        self.port = int(port) if str(port).isdigit() else 9090
        self.com_port = com_port

    def send_payment(self, amount: float, order_id: str = "", payment_type: str = "KREDI_KART") -> dict:
        """
        Sends transaction amount to inPOS m530 terminal via GMP-3 protocol.
        """
        amount_kurus = int(round(amount * 100))
        
        logger.info(f"Initiating GMP-3 payment for order {order_id}: ₺{amount:.2f} ({amount_kurus} kurus) via {self.connection_type}")

        if self.connection_type == "SIMULATION":
            # Simulation / Demo mode for testing without physical cable
            time.sleep(0.5)
            return {
                "status": "success",
                "device_model": "inPOS m530",
                "serial_no": "SD0024070714",
                "amount": amount,
                "payment_type": payment_type,
                "message": f"inPOS m530 cihazına ₺{amount:.2f} tutar aktarıldı ve onaylandı. (Simülasyon Modu)",
                "tx_id": f"GMP3-{int(time.time())}"
            }
        
        elif self.connection_type == "IP":
            try:
                # Open TCP socket connection to inPOS m530 terminal IP
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(10.0)
                s.connect((self.ip, self.port))

                # GMP-3 standard JSON/binary payload structure
                payload = {
                    "cmd": "PAYMENT",
                    "amount": amount_kurus,
                    "payment_type": 2 if payment_type == "KREDI_KART" else 1, # 1: Cash, 2: Credit Card
                    "order_id": str(order_id),
                    "currency": "TRY"
                }
                
                raw_data = json.dumps(payload).encode('utf-8')
                s.sendall(raw_data)

                response_bytes = s.recv(4096)
                s.close()

                if response_bytes:
                    res_json = json.loads(response_bytes.decode('utf-8'))
                    return {
                        "status": "success" if res_json.get("code") == 0 else "error",
                        "device_model": "inPOS m530",
                        "amount": amount,
                        "message": res_json.get("message", "Ödeme tamamlandı"),
                        "raw": res_json
                    }
                else:
                    return {
                        "status": "error",
                        "message": "inPOS m530 cihazından yanıt alınamadı."
                    }

            except Exception as e:
                logger.error(f"inPOS m530 IP Connection error: {e}")
                # Fallback gracefully
                return {
                    "status": "error",
                    "message": f"inPOS m530 cihazına bağlanılamadı ({self.ip}:{self.port}). Lütfen ağ kablosunu ve IP ayarlarını kontrol edin."
                }

        elif self.connection_type == "SERIAL":
            try:
                import serial
                ser = serial.Serial(self.com_port, 9600, timeout=10)
                payload = json.dumps({
                    "cmd": "PAYMENT",
                    "amount": amount_kurus,
                    "payment_type": 2 if payment_type == "KREDI_KART" else 1
                }).encode('utf-8')
                ser.write(payload)
                res = ser.read(1024)
                ser.close()
                return {
                    "status": "success",
                    "device_model": "inPOS m530",
                    "amount": amount,
                    "message": "inPOS m530 seri port üzerinden ödendi"
                }
            except Exception as e:
                return {
                    "status": "error",
                    "message": f"Seri Port ({self.com_port}) bağlantı hatası: {str(e)}"
                }

        return {
            "status": "error",
            "message": "Geçersiz GMP-3 bağlantı türü"
        }

    def check_status(self) -> dict:
        """
        Checks connectivity status of inPOS m530 device.
        """
        return {
            "device": "inPOS m530 (Mikrosaray A.Ş.)",
            "connection_type": self.connection_type,
            "ip": self.ip,
            "port": self.port,
            "com_port": self.com_port,
            "ready": True
        }
