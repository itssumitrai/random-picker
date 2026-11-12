# Runs on the mini-pc's Windows side (called from remote-install.sh via powershell.exe).
# Makes the WSL2 server reachable from the LAN and keeps the WSL distro running.
param(
	[Parameter(Mandatory)] [int] $Port,
	[Parameter(Mandatory)] [string] $WslIp,
	[Parameter(Mandatory)] [string] $Distro,
	[Parameter(Mandatory)] [string] $LinuxUser
)
$ErrorActionPreference = 'Stop'

# Port proxy, IPv4 and IPv6 (mini-pc.local also resolves to IPv6, which browsers may try first).
# The WSL2 NAT address can change after a reboot, so re-point it on every deploy.
netsh interface portproxy delete v4tov4 listenport=$Port listenaddress=0.0.0.0 2>$null | Out-Null
netsh interface portproxy delete v6tov4 listenport=$Port listenaddress=:: 2>$null | Out-Null
netsh interface portproxy add v4tov4 listenport=$Port listenaddress=0.0.0.0 connectport=$Port connectaddress=$WslIp | Out-Null
netsh interface portproxy add v6tov4 listenport=$Port listenaddress=:: connectport=$Port connectaddress=$WslIp | Out-Null
Write-Output "Windows forwards 0.0.0.0:$Port and [::]:$Port -> ${WslIp}:$Port"

$rule = "Spindle (TCP $Port)"
if (-not (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue)) {
	New-NetFirewallRule -DisplayName $rule -Direction Inbound -Action Allow -Protocol TCP `
		-LocalPort $Port -Profile Private | Out-Null
	Write-Output "Added firewall rule '$rule'"
}

# WSL stops a distro (and its systemd services) ~15s after its last client process exits.
# A scheduled task holding `sleep infinity` open keeps it, and the server, running.
$task = "WSL keepalive ($Distro)"
if (-not (Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue)) {
	$action = New-ScheduledTaskAction -Execute "$env:WINDIR\System32\wsl.exe" `
		-Argument "-d $Distro -u $LinuxUser --exec /bin/sleep infinity"
	$trigger = New-ScheduledTaskTrigger -AtStartup
	# S4U runs at boot without a logged-in user and without storing a password.
	# Take the account from the process identity: over SSH, $env:USERDOMAIN is the workgroup, not the machine.
	$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
	$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
	$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) `
		-AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -DontStopOnIdleEnd `
		-RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
	Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Principal $principal `
		-Settings $settings -Description 'Keeps the WSL distro alive so systemd services (Spindle) stay up.' | Out-Null
	Write-Output "Registered scheduled task '$task'"
}
if ((Get-ScheduledTask -TaskName $task).State -ne 'Running') {
	Start-ScheduledTask -TaskName $task
	Write-Output "Started scheduled task '$task'"
}
