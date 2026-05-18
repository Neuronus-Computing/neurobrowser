// Copyright 2024 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_UI_WEBUI_NEUROBROWSER_NTP_NEUROBROWSER_NTP_MESSAGE_HANDLER_H_
#define CHROME_BROWSER_UI_WEBUI_NEUROBROWSER_NTP_NEUROBROWSER_NTP_MESSAGE_HANDLER_H_

#include "base/memory/raw_ptr.h"
#include "base/values.h"
#include "components/search_engines/template_url_service.h"
#include "components/search_engines/template_url_service_observer.h"
#include "content/public/browser/web_ui_message_handler.h"

class Profile;

// Handles messages from the NeuroBrowser NTP page.
class NeuroBrowserNtpMessageHandler : public content::WebUIMessageHandler,
                                       public TemplateURLServiceObserver {
 public:
  explicit NeuroBrowserNtpMessageHandler(Profile* profile);

  NeuroBrowserNtpMessageHandler(const NeuroBrowserNtpMessageHandler&) = delete;
  NeuroBrowserNtpMessageHandler& operator=(
      const NeuroBrowserNtpMessageHandler&) = delete;

  ~NeuroBrowserNtpMessageHandler() override;

  // content::WebUIMessageHandler:
  void RegisterMessages() override;
  void OnJavascriptAllowed() override;
  void OnJavascriptDisallowed() override;

  // TemplateURLServiceObserver:
  void OnTemplateURLServiceChanged() override;

 private:
  // Message handlers.
  void HandleGetSearchEngines(const base::ListValue& args);
  void HandleSetDefaultSearchEngine(const base::ListValue& args);
  void HandlePerformSearch(const base::ListValue& args);
  void HandleOpenUrl(const base::ListValue& args);

  // Sends the current list of search engines to the page.
  void SendSearchEngines();

  // Builds a list of search engines as base::Value.
  base::ListValue GetSearchEnginesList();

  raw_ptr<Profile> profile_;
  raw_ptr<TemplateURLService> template_url_service_;
};

#endif  // CHROME_BROWSER_UI_WEBUI_NEUROBROWSER_NTP_NEUROBROWSER_NTP_MESSAGE_HANDLER_H_
