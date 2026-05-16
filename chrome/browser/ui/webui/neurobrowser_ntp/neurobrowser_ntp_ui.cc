// Copyright 2024 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/webui/neurobrowser_ntp/neurobrowser_ntp_ui.h"

#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/webui/neurobrowser_ntp/neurobrowser_ntp_message_handler.h"
#include "chrome/common/webui_url_constants.h"
#include "chrome/grit/neurobrowser_ntp_resources.h"
#include "chrome/grit/neurobrowser_ntp_resources_map.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "services/network/public/mojom/content_security_policy.mojom.h"
#include "ui/webui/webui_util.h"

NeuroBrowserNtpUIConfig::NeuroBrowserNtpUIConfig()
    : DefaultWebUIConfig(content::kChromeUIScheme,
                         chrome::kChromeUINeuroBrowserNtpHost) {}

NeuroBrowserNtpUI::NeuroBrowserNtpUI(content::WebUI* web_ui)
    : WebUIController(web_ui) {
  Profile* profile = Profile::FromWebUI(web_ui);
  
  // Add message handler for search engine operations
  web_ui->AddMessageHandler(
      std::make_unique<NeuroBrowserNtpMessageHandler>(profile));
  
  content::WebUIDataSource* source = content::WebUIDataSource::CreateAndAdd(
      profile, chrome::kChromeUINeuroBrowserNtpHost);

  // Add all resources
  webui::SetupWebUIDataSource(
      source, kNeurobrowserNtpResources,
      IDR_NEUROBROWSER_NTP_NEUROBROWSER_NTP_HTML);

  // Allow external font loading
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::FontSrc,
      "font-src https://fonts.gstatic.com 'self';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::StyleSrc,
      "style-src https://fonts.googleapis.com 'self' 'unsafe-inline';");

  // Allow inline scripts and chrome://resources for WebUI listener
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc,
      "script-src chrome://resources 'self' 'unsafe-inline';");

  // Allow chrome:// favicon URLs and external images
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ImgSrc,
      "img-src chrome://favicon chrome://theme https: data: 'self';");
}

NeuroBrowserNtpUI::~NeuroBrowserNtpUI() = default;
