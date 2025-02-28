/*
Copyright 2022 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  SequenceDiagramViewer,
  SequenceDiagramMatrixEvent,
} from "./room/GroupCallInspector";
import { FieldRow, InputField } from "./input/Input";
import { usePageTitle } from "./usePageTitle";

interface DebugLog {
  localUserId: string;
  eventsByUserId: { [userId: string]: SequenceDiagramMatrixEvent[] };
  remoteUserIds: string[];
}

export function SequenceDiagramViewerPage() {
  const { t } = useTranslation();
  usePageTitle(t("Inspector"));

  const [debugLog, setDebugLog] = useState<DebugLog>();
  const [selectedUserId, setSelectedUserId] = useState<string>();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const onChangeDebugLog = useCallback((e) => {
    if (e.target.files && e.target.files.length > 0) {
      e.target.files[0].text().then((text: string) => {
        setDebugLog(JSON.parse(text));
      });
    }
  }, []);

  return (
    <div style={{ marginTop: 20 }}>
      <FieldRow>
        <InputField
          type="file"
          id="debugLog"
          name="debugLog"
          label={t("Debug log")}
          onChange={onChangeDebugLog}
        />
      </FieldRow>
      {debugLog && selectedUserId && (
        <SequenceDiagramViewer
          localUserId={debugLog.localUserId}
          selectedUserId={selectedUserId}
          onSelectUserId={setSelectedUserId}
          remoteUserIds={debugLog.remoteUserIds}
          events={debugLog.eventsByUserId[selectedUserId]}
        />
      )}
    </div>
  );
}
