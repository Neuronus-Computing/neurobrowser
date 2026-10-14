// Copyright 2024 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_UI_WEBUI_NEUROBROWSER_NTP_NEUROBROWSER_NTP_UI_H_
#define CHROME_BROWSER_UI_WEBUI_NEUROBROWSER_NTP_NEUROBROWSER_NTP_UI_H_

#include "chrome/common/webui_url_constants.h"
#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"
#include "content/public/common/url_constants.h"

class NeuroBrowserNtpUI;

class NeuroBrowserNtpUIConfig
    : public content::DefaultWebUIConfig<NeuroBrowserNtpUI> {
 public:
  NeuroBrowserNtpUIConfig();
};

class NeuroBrowserNtpUI : public content::WebUIController {
 public:
  explicit NeuroBrowserNtpUI(content::WebUI* web_ui);

  NeuroBrowserNtpUI(const NeuroBrowserNtpUI&) = delete;
  NeuroBrowserNtpUI& operator=(const NeuroBrowserNtpUI&) = delete;

  ~NeuroBrowserNtpUI() override;

  static constexpr std::string GetWebUIName() {
    return "NeuroBrowserNtp";
  }
};

#endif  // CHROME_BROWSER_UI_WEBUI_NEUROBROWSER_NTP_NEUROBROWSER_NTP_UI_H_
