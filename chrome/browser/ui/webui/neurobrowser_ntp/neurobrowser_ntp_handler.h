// Copyright 2024 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_UI_WEBUI_NEUROBROWSER_NTP_NEUROBROWSER_NTP_HANDLER_H_
#define CHROME_BROWSER_UI_WEBUI_NEUROBROWSER_NTP_NEUROBROWSER_NTP_HANDLER_H_

#include "base/memory/raw_ptr.h"
#include "chrome/browser/ui/webui/neurobrowser_ntp/neurobrowser_ntp.mojom.h"
#include "components/search_engines/template_url_service.h"
#include "components/search_engines/template_url_service_observer.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"
#include "mojo/public/cpp/bindings/pending_remote.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "mojo/public/cpp/bindings/remote.h"

class Profile;

namespace content {
class WebContents;
}

class NeuroBrowserNtpHandler : public neurobrowser_ntp::mojom::PageHandler,
                               public TemplateURLServiceObserver {
 public:
  NeuroBrowserNtpHandler(
      mojo::PendingReceiver<neurobrowser_ntp::mojom::PageHandler>
          pending_page_handler,
      mojo::PendingRemote<neurobrowser_ntp::mojom::Page> pending_page,
      Profile* profile,
      content::WebContents* web_contents);

  NeuroBrowserNtpHandler(const NeuroBrowserNtpHandler&) = delete;
  NeuroBrowserNtpHandler& operator=(const NeuroBrowserNtpHandler&) = delete;

  ~NeuroBrowserNtpHandler() override;

  // neurobrowser_ntp::mojom::PageHandler:
  void GetSearchEngines(GetSearchEnginesCallback callback) override;
  void SetDefaultSearchEngine(const std::string& keyword) override;
  void GetRecentTabs(GetRecentTabsCallback callback) override;
  void OpenUrl(const std::string& url) override;
  void PerformSearch(const std::string& query) override;

  // TemplateURLServiceObserver:
  void OnTemplateURLServiceChanged() override;

 private:
  void NotifySearchEnginesChanged();
  std::vector<neurobrowser_ntp::mojom::SearchEnginePtr> GetSearchEnginesList();

  raw_ptr<Profile> profile_;
  raw_ptr<content::WebContents> web_contents_;
  raw_ptr<TemplateURLService> template_url_service_;

  mojo::Remote<neurobrowser_ntp::mojom::Page> page_;
  mojo::Receiver<neurobrowser_ntp::mojom::PageHandler> receiver_;
};

#endif  // CHROME_BROWSER_UI_WEBUI_NEUROBROWSER_NTP_NEUROBROWSER_NTP_HANDLER_H_
