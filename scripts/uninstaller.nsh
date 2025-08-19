!macro customUnInstall

  DetailPrint "Closing ${PRODUCT_NAME}..."

  FindWindow $R0 "Chrome_WidgetWin_1"
  ${If} $R0 != 0
    SendMessage $R0 0x10 0 0
    Sleep 1000
  ${EndIf}

  ExecWait 'taskkill /F /IM "${APP_FILENAME}.exe"'

  ; 설치 폴더 삭제
  System::Call 'Kernel32::GetEnvironmentVariable(t, t, i) i("LOCALAPPDATA", .R0, 260)'
  StrCpy $R5 "$R0\Programs\${PRODUCT_NAME}"
  DetailPrint "Removing app folder: $R5"
  RMDir /r "$R5"

  ; 업데이터 폴더 삭제
  StrCpy $R6 "$R0\holo-alarm-updater"
  DetailPrint "Removing updater folder: $R6"
  RMDir /r "$R6"

  ; 유저 데이터 삭제 여부
  StrCmp $1 "update" 0 +4
    DetailPrint "Skipping user data removal on update"
    Goto afterUser
    System::Call 'Kernel32::GetEnvironmentVariable(t, t, i) i("APPDATA", .R0, 260)'
    StrCpy $R7 "$R0\holo-alarm"
    DetailPrint "Removing roaming app data folder: $R7"
    RMDir /r "$R7"
  afterUser:

  ; 바로가기 삭제
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"

  ; 시작 프로그램 레지스트리 삭제
  DetailPrint "Removing startup registry entry..."
  DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "${PRODUCT_NAME}"

!macroend
