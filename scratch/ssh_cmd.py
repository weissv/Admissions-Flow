import sys
import paramiko

def run_ssh_command(cmd):
    host = "185.217.131.26"
    port = 22
    username = "root"
    password = "Z@pu2laGYwsSF?N$"

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, port=port, username=username, password=password, timeout=10)
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        
        sys.stdout.buffer.write(b"=== STDOUT ===\n")
        sys.stdout.buffer.write(out.encode('utf-8', errors='ignore'))
        sys.stdout.buffer.write(b"\n=== STDERR ===\n")
        sys.stdout.buffer.write(err.encode('utf-8', errors='ignore'))
        sys.stdout.buffer.write(b"\n")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ssh_cmd.py <command>")
        sys.exit(1)
    cmd = " ".join(sys.argv[1:])
    run_ssh_command(cmd)
