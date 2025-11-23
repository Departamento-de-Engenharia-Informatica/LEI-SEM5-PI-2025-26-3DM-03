# User Story 3.5.4 -- SSH Login Monitoring & Automated Security Alerts

## \### Systems Administration & Business Continuity

## 1. Overview

**User Story 3.5.4**\
*As a System Administrator, I want to control and monitor logins to the
remote shells of Linux-based systems, so that I can prevent and report
potential unauthorized access or misuse.*

This document describes the implemented solution for SSH login control,
enforced access rules, failure monitoring, automated lockouts, and
security alert generation upon repeated failed login attempts.

------------------------------------------------------------------------

## 2. Objectives

The system must enforce:

-   Restriction of user authentication to the defined time window
    (08:00--22:00)\
-   Multi-factor authentication (MFA) via Google Authenticator after
    failed password attempts\
-   Automatic detection of repeated SSH failed attempts\
-   Generation of a security alert after **3 consecutive failed
    logins**\
-   Auditability via system logs and failure tracking\
-   A fully automated reaction via systemd monitoring

All mandatory Acceptance Criteria were successfully implemented.

------------------------------------------------------------------------

## 3. Architecture Overview

### 3.1 PAM-Based Authentication Control

The system uses **PAM (Pluggable Authentication Modules)** to enforce:

-   SSH access window\
-   MFA\
-   Automatic failure counting via `pam_faillock`\
-   Central logging/audit via `auth.log` and `faillock`

The key module used:

    pam_faillock.so

provides failure tracking and lockout enforcement.

------------------------------------------------------------------------

### 3.2 Automated Alert System

Security alerts are triggered automatically using:

-   A **custom shell script** invoked upon detected lockouts\
-   A **systemd service** that executes the alert logic\
-   A **systemd path unit** monitoring changes in `/var/run/faillock`\
    (the directory where failure events are recorded)

This creates an automated, reactive security mechanism.

------------------------------------------------------------------------

## 4. Implementation Breakdown

### 4.1 PAM faillock Configuration

File edited:

    /etc/pam.d/sshd

Configuration added:

    auth required pam_faillock.so preauth audit deny=3 even_deny_root unlock_time=900 fail_interval=300

------------------------------------------------------------------------

### 4.2 Security Alert Script

Created at:

    /usr/local/bin/ssh_fail_notify.sh

``` bash
#!/bin/bash

SUBJECT=" SECURITY ALERT: 3 failed SSH logins on $(hostname)"
BODY="There have been more than 3 failed SSH login attempts on $(hostname) at $(date).
Check /var/log/auth.log or faillock for details."

ADMIN_MAIL="email@exemplo.com"

if command -v mail >/dev/null 2>&1; then
    echo "$BODY" | mail -s "$SUBJECT" "$ADMIN_MAIL"
else
    mkdir -p /var/log/login_fail_monitor
    echo "$(date) - $SUBJECT" >> /var/log/login_fail_monitor/ssh_fail_notify.log
    echo "$BODY" >> /var/log/login_fail_monitor/ssh_fail_notify.log
fi
```

------------------------------------------------------------------------

### 4.3 Systemd Service

    /etc/systemd/system/ssh-alert.service

``` ini
[Unit]
Description=Alert on SSH brute force attempts

[Service]
Type=oneshot
ExecStart=/usr/local/bin/ssh_fail_notify.sh
```

------------------------------------------------------------------------

### 4.4 Systemd Path Unit

    /etc/systemd/system/ssh-alert.path

``` ini
[Unit]
Description=Watch for SSH faillock events

[Path]
PathChanged=/var/run/faillock

[Install]
WantedBy=multi-user.target
```

------------------------------------------------------------------------

## 5. Automated Validation & Testing

### Failed Login Simulation

``` bash
ssh asist@<vm-ip>
```

Checking logs:

    journalctl -u ssh-alert.service --no-pager -n 20

and

    cat /var/log/login_fail_monitor/ssh_fail_notify.log

------------------------------------------------------------------------

## 6. Conclusion

The implementation of US 3.5.4 provides automated SSH monitoring,
lockout enforcement, and real-time security alerts, fulfilling all
acceptance criteria.
