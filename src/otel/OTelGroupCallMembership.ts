/*
Copyright 2023 New Vector Ltd

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

import opentelemetry, { Context, Span } from "@opentelemetry/api";
import {
  GroupCall,
  MatrixClient,
  MatrixEvent,
  RoomMember,
} from "matrix-js-sdk";
import { VoipEvent } from "matrix-js-sdk/src/webrtc/call";

import { tracer } from "./otel";

/**
 * Recursively sets the contents of a todevice event object as attributes on a span
 */
function setNestedAttributesFromEvent(span: Span, event: VoipEvent) {
  setSpanEventAttributesRecursive(
    span,
    event as unknown as Record<string, unknown>, // XXX Types
    "matrix.event.",
    0
  );
}

function setSpanEventAttributesRecursive(
  span: Span,
  obj: Record<string, unknown>,
  prefix: string,
  depth: number
) {
  if (depth > 10)
    throw new Error(
      "Depth limit exceeded: aborting VoipEvent recursion. Prefix is " + prefix
    );

  for (const [k, v] of Object.entries(obj)) {
    if (["string", "number"].includes(typeof v)) {
      span.setAttribute(prefix + k, v as string | number);
    } else if (typeof v === "object") {
      setSpanEventAttributesRecursive(
        span,
        v as Record<string, unknown>,
        prefix + k + ".",
        depth + 1
      );
    }
  }
}

/**
 * Represent the span of time which we intend to be joined to a group call
 */
export class OTelGroupCallMembership {
  private context: Context;
  private callMembershipSpan: Span;
  private myUserId: string;
  private myMember: RoomMember;

  constructor(private groupCall: GroupCall, client: MatrixClient) {
    this.myUserId = client.getUserId();
    this.myMember = groupCall.room.getMember(client.getUserId());
  }

  public onJoinCall() {
    // Create a new call based on the callIdContext. This context also has a span assigned to it.
    // Other spans can use this context to extract the parent span.
    // (When passing this context to startSpan the started span will use the span set in the context (in this case the callSpan) as the parent)

    // Create the main span that tracks the time we intend to be in the call
    this.callMembershipSpan = tracer.startSpan("otel_groupCallMembershipSpan");

    this.context = opentelemetry.trace
      .setSpan(opentelemetry.context.active(), this.callMembershipSpan)
      .setValue(Symbol("confId"), this.groupCall.groupCallId)
      .setValue(Symbol("matrix.userId"), this.myUserId)
      .setValue(Symbol("matrix.displayName"), this.myMember.name);

    // Here we start a very short span. This is a hack to trigger the posthog exporter.
    // Only ended spans are processed by the exporter.
    // We want the exporter to know that a call has started
    const joinCallSpan = tracer.startSpan(
      "otel_joinCallSpan",
      undefined,
      this.context
    );
    joinCallSpan.end();
  }

  public onLeaveCall() {
    // A very short span to represent us leaving the call
    const startCallSpan = tracer.startSpan(
      "otel_leaveCallSpan",
      undefined,
      this.context
    );
    startCallSpan.end();

    // and end the main span to indicate we've left
    if (this.callMembershipSpan) this.callMembershipSpan.end();
  }

  public onUpdateRoomState(event: MatrixEvent) {
    if (
      !event ||
      (!event.getType().startsWith("m.call") &&
        !event.getType().startsWith("org.matrix.msc3401.call"))
    )
      return;

    const span = tracer.startSpan(
      `otel_onRoomStateEvent_${event.getType()}`,
      undefined,
      this.context
    );

    setNestedAttributesFromEvent(span, event.getContent());
    span.end();
  }

  public onSendEvent(event: VoipEvent) {
    const eventType = event.eventType as string;
    if (!eventType.startsWith("m.call")) return;

    if (event.type === "toDevice") {
      const span = tracer.startSpan(
        `otel_sendToDeviceEvent_${event.eventType}`,
        undefined,
        this.context
      );

      setNestedAttributesFromEvent(span, event);
      span.end();
    } else if (event.type === "sendEvent") {
      const span = tracer.startSpan(
        `otel_sendToRoomEvent_${event.eventType}`,
        undefined,
        this.context
      );

      setNestedAttributesFromEvent(span, event);
      span.end();
    }
  }
}
