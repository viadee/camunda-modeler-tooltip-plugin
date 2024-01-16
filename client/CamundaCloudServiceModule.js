import {
  emptyPropertiesIfNoLines,
  findBusinessKey,
  findEventDefinitionType,
  findExtension,
  findExtensionByType,
  overlay,
  tooltipHeader
} from "./GeneralServiceModule";

const _ = require("lodash");
const _html_ok = '&#10004;';
const _html_nok = '&#10006;';

/**
 * add tooltip regarding an element, using the given tooltip-id in html
 */
export function addTooltip(elementOverlays, overlays, element, tooltipId) {
  elementOverlays[element.id].push(
      overlays.add(
          element, 'tooltip-info',
          overlay(buildTooltipOverlay(element, tooltipId))));
}

/**
 * build a complete tooltip-overlay-html, consisting of header, and
 * detail-containers, if any information is, otherwise show resp. hint.
 *
 * some containers are disabled currently, bc. the information is not really needed
 * to show in tooltip, or can be visualized by other plugins already.
 */
function buildTooltipOverlay(element, tooltipId) {
  return '<div id="' + tooltipId + '" class="tooltip"> \
              <div class="tooltip-content">'
      + tooltipHeader(element)
      + emptyPropertiesIfNoLines([
        tooltipDetails(element)
      ])
      + '</div> \
            </div>';
}

/**
 * container for details:
 *  - properties depending on element-type
 *  - e.g. type of implementation
 */
function tooltipDetails(element) {
  if (element.businessObject === undefined) return '';

  let lines = [];
  let type = element.businessObject.$type;

  if (type == 'bpmn:ServiceTask' || type == 'bpmn:SendTask') evaluateServiceSendConnectorTask(element, lines);
  if (type == 'bpmn:BusinessRuleTask') evaluateBusinessRuleTask(element, lines);
  if (type == 'bpmn:ReceiveTask') evaluateReceiveTask(element, lines);
  if (type == 'bpmn:ScriptTask') evaluateScriptTask(element, lines);
  if (type == 'bpmn:CallActivity') evaluateCallActivity(element, lines);

  // TODO
  if (type == 'bpmn:UserTask') evaluateUserTask(element, lines);
  if (type == 'bpmn:StartEvent'
      || type == 'bpmn:EndEvent'
      || type == 'bpmn:IntermediateCatchEvent'
      || type == 'bpmn:IntermediateThrowEvent'
      || type == 'bpmn:BoundaryEvent') evaluateEvents(element, lines);

  return addHeaderRemoveEmptyLinesAndFinalize('Details', lines);
}

/**
 * evaluate service-/send-/connector-tasks
 */
function evaluateServiceSendConnectorTask(element, lines) {
  let taskDefinitionExtension = findExtensionByType(element, "zeebe:TaskDefinition")
  let implementationType = element.businessObject.modelerTemplate === undefined ?
      'External' : 'Connector'
  lines.push(tooltipLineText('Implementation', implementationType))

  if (taskDefinitionExtension !== undefined) {
    lines.push(tooltipLineText('Type', taskDefinitionExtension.type)) // aka topic
    lines.push(tooltipLineText('Retries', taskDefinitionExtension.retries))
  }
}

/**
 * evaluate rule-tasks
 */
function evaluateBusinessRuleTask(element, lines) {
  let businessRuleTaskElementDMN = findExtensionByType(element, "zeebe:CalledDecision")
  let businessRuleTaskElementJobWorker = findExtensionByType(element, "zeebe:TaskDefinition")

  if (businessRuleTaskElementDMN !== undefined) {
    lines.push(tooltipLineText('Implementation', 'DMN Decision'))
    lines.push(tooltipLineText('Decision ID', businessRuleTaskElementDMN.decisionId));
    lines.push(tooltipLineText('Result Variable', businessRuleTaskElementDMN.resultVariable));
  }
  if (businessRuleTaskElementJobWorker !== undefined) {
    lines.push(tooltipLineText('Implementation', 'Job Worker'))
    lines.push(tooltipLineText('Type', businessRuleTaskElementJobWorker.type))
    lines.push(tooltipLineText('Retries', businessRuleTaskElementJobWorker.retries))
  }
}

/**
 * evaluate receive-tasks
 */
function evaluateReceiveTask(element, lines) {
  let messageRef = element.businessObject.messageRef

  if (messageRef != undefined) {
    let subscriptionKeyElement = findExtension(messageRef.extensionElements.values, "zeebe:Subscription")
    lines.push(tooltipLineText('Message Name', element.businessObject.messageRef.name));
    lines.push(tooltipLineText('Subscription Key', subscriptionKeyElement.correlationKey))
  }
}

/**
 * evaluate script-tasks
 */
function evaluateScriptTask(element, lines) {
  let scriptTaskElementFEEL = findExtensionByType(element, "zeebe:Script")
  let scriptTaskElementJobWorker = findExtensionByType(element, "zeebe:TaskDefinition")

  if (scriptTaskElementFEEL !== undefined) {
    lines.push(tooltipLineText('Implementation', 'FEEL'))
    lines.push(tooltipLineText('Result Variable', scriptTaskElementFEEL.resultVariable))
    lines.push(tooltipLineText('Expression', scriptTaskElementFEEL.expression))
  }
  if (scriptTaskElementJobWorker !== undefined) {
    lines.push(tooltipLineText('Implementation', 'Job Worker'))
    lines.push(tooltipLineText('Type', scriptTaskElementJobWorker.type))
    lines.push(tooltipLineText('Retries', scriptTaskElementJobWorker.retries))
  }
}

/**
 * evaluate call-activities
 */
function evaluateCallActivity(element, lines) {
  let callActivityElement = findExtensionByType(element, "zeebe:CalledElement")

  if (callActivityElement !== undefined) {
    lines.push(tooltipLineText('Process ID', callActivityElement.processId));
    lines.push(tooltipLineText('Propagation of Parent Variables', callActivityElement.propagateAllParentVariables));
    lines.push(tooltipLineText('Propagation of Child Variables', callActivityElement.propagateAllChildVariables));
  }
}

/**
 * evaluate user-tasks
 */
function evaluateUserTask(element, lines) {
  lines.push(tooltipLineText('Assignee', element.businessObject.assignee));
  lines.push(tooltipLineText('Candidate Users', element.businessObject.candidateUsers));
  lines.push(tooltipLineText('Candidate Groups', element.businessObject.candidateGroups));
  lines.push(tooltipLineText('Due Date', element.businessObject.dueDate));
  lines.push(tooltipLineText('Follow Up Date', element.businessObject.followUpDate));
  lines.push(tooltipLineText('Priority', element.businessObject.priority));
}

/**
 * evaluate events
 */
function evaluateEvents(element, lines) {
  if (findEventDefinitionType(element, 'bpmn:MessageEventDefinition') != undefined) {
    var eventDefinition = findEventDefinitionType(element, 'bpmn:MessageEventDefinition');
    if (eventDefinition.class != undefined) {
      lines.push(tooltipLineText('Implementation', 'Java Class'));
      lines.push(tooltipLineCode('Class', eventDefinition.class));
    }

    if (eventDefinition.expression != undefined) {
      lines.push(tooltipLineText('Implementation', 'Expression'));
      lines.push(tooltipLineCode('Expression', eventDefinition.expression));
      lines.push(tooltipLineText('Result Variable', eventDefinition.resultVariable));
    }

    if (eventDefinition.delegateExpression != undefined) {
      lines.push(tooltipLineText('Implementation', 'Delegate Expression'));
      lines.push(tooltipLineCode('Delegate Expression', eventDefinition.delegateExpression));
    }

    if (eventDefinition.type != undefined) {
      lines.push(tooltipLineText('Implementation', 'External'));
      lines.push(tooltipLineCode('Topic', eventDefinition.topic));
    }

    if (eventDefinition.extensionElements != undefined && findExtension(eventDefinition.extensionElements.values, 'camunda:Connector') != undefined) {
      lines.push(tooltipLineText('Implementation', 'Connector'));
    }

    if (eventDefinition.messageRef != undefined) {
      // lines.push(tooltipLineText('Message', eventDefinition.messageRef.id));
      lines.push(tooltipLineText('Message Name', eventDefinition.messageRef.name));
    }
  }

  if (findEventDefinitionType(element, 'bpmn:EscalationEventDefinition') != undefined) {
    var eventDefinition = findEventDefinitionType(element, 'bpmn:EscalationEventDefinition');
    if (eventDefinition.escalationRef != undefined) {
      // lines.push(tooltipLineText('Escalation', eventDefinition.escalationRef.id));
      lines.push(tooltipLineText('Escalation Name', eventDefinition.escalationRef.name));
      lines.push(tooltipLineText('Escalation Code', eventDefinition.escalationRef.escalationCode));
      lines.push(tooltipLineText('Escalation Code Variable', eventDefinition.escalationCodeVariable));
    }
  }

  if (findEventDefinitionType(element, 'bpmn:ErrorEventDefinition') != undefined) {
    var eventDefinition = findEventDefinitionType(element, 'bpmn:ErrorEventDefinition');
    if (eventDefinition.errorRef != undefined) {
      // lines.push(tooltipLineText('Error', eventDefinition.errorRef.id));
      lines.push(tooltipLineText('Error Name', eventDefinition.errorRef.name));
      lines.push(tooltipLineText('Error Code', eventDefinition.errorRef.errorCode));
      lines.push(tooltipLineText('Error Message', eventDefinition.errorRef.errorMessage));
      lines.push(tooltipLineText('Error Code Variable', eventDefinition.errorCodeVariable));
      lines.push(tooltipLineText('Error Message Variable', eventDefinition.errorMessageVariable));
    }
  }

  if (findEventDefinitionType(element, 'bpmn:CompensateEventDefinition') != undefined) {
    var eventDefinition = findEventDefinitionType(element, 'bpmn:CompensateEventDefinition');
    lines.push(tooltipLineText('Wait for Completion', eventDefinition.waitForCompletion ? _html_ok : _html_nok));
    if (eventDefinition.activityRef != undefined) {
      lines.push(tooltipLineText('Activity Ref', eventDefinition.activityRef.id));
    }
  }

  if (findEventDefinitionType(element, 'bpmn:SignalEventDefinition') != undefined) {
    var eventDefinition = findEventDefinitionType(element, 'bpmn:SignalEventDefinition');
    if (eventDefinition.signalRef != undefined) {
      // lines.push(tooltipLineText('Signal', eventDefinition.signalRef.id));
      lines.push(tooltipLineText('Signal Name', eventDefinition.signalRef.name));
    }
  }

  if (findEventDefinitionType(element, 'bpmn:TimerEventDefinition') != undefined) {
    var eventDefinition = findEventDefinitionType(element, 'bpmn:TimerEventDefinition');
    if (eventDefinition.timeDate != undefined) {
      lines.push(tooltipLineText('Timer', 'Date'));
      lines.push(tooltipLineText('Timer Definition', eventDefinition.timeDate.body));
    }
    if (eventDefinition.timeDuration != undefined) {
      lines.push(tooltipLineText('Timer', 'Duration'));
      lines.push(tooltipLineText('Timer Definition', eventDefinition.timeDuration.body));
    }
    if (eventDefinition.timeCycle != undefined) {
      lines.push(tooltipLineText('Timer', 'Cycle'));
      lines.push(tooltipLineText('Timer Definition', eventDefinition.timeCycle.body));
    }
  }

  if (findEventDefinitionType(element, 'bpmn:ConditionalEventDefinition') != undefined) {
    var eventDefinition = findEventDefinitionType(element, 'bpmn:ConditionalEventDefinition');
    lines.push(tooltipLineText('Variable Name', eventDefinition.variableName));
    lines.push(tooltipLineText('Variable Event', eventDefinition.variableEvent));
    if (eventDefinition.condition != undefined && eventDefinition.condition.language != undefined) {
      lines.push(tooltipLineText('Condition Type', 'Script'));
      lines.push(tooltipLineText('Script Format', eventDefinition.condition.language));
      if (eventDefinition.condition.resource != undefined) {
        lines.push(tooltipLineText('Script Type', 'External Resource'));
        lines.push(tooltipLineText('Resource', eventDefinition.condition.resource));
      } else {
        lines.push(tooltipLineText('Script Type', 'Inline Script'));
        lines.push(tooltipLineCode('Script', eventDefinition.condition.body.replace(/(?:\r\n|\r|\n)/g, '<br />')));
      }
    } else {
      lines.push(tooltipLineText('Condition Type', 'Expression'));
      lines.push(tooltipLineCode('Expression', eventDefinition.condition.body));
    }
  }

  lines.push(tooltipLineText('Initiator', element.businessObject.initiator));
}

/* >-- methods to assemble tooltip lines --< */

/**
 * add a single tooltip line as 'text'
 */
function tooltipLineText(key, value) {
  return tooltipLineWithCss(key, value, 'tooltip-value-text');
}

/**
 * add a single tooltip line as 'code'
 */
function tooltipLineCode(key, value) {
  return tooltipLineWithCss(key, value, 'tooltip-value-code');
}

/**
 * add a single tooltip line as 'code'
 */
function tooltipLineCodeWithFallback(key, value, fallback) {
  if (value == undefined) {
    return tooltipLineCode(key, fallback);
  } else {
    return tooltipLineCode(key, value);
  }
}

/**
 * add a single tooltip line as <div> with 2 <span>,
 * like: <div><span>key: </span><span class="css">value</span></div>
 */
function tooltipLineWithCss(key, value, css) {
  if (value == undefined) return '';
  return `<div class="tooltip-line"><span class="tooltip-key">${key}:&nbsp;</span><span class="tooltip-value ${css}">${value}</span></div>`;
}

/**
 * create a tooltip-container with header (e.g. 'Details') and add all respective properties.
 * if there is no property present, the container is not created.
 */
function addHeaderRemoveEmptyLinesAndFinalize(subheader, lines) {
  var final = _.without(lines, "");
  if (final.length == 0) return '';

  var html = '<div class="tooltip-container"> \
                  <div class="tooltip-subheader">' + subheader + '</div>';

  _.each(final, function (line) {
    html += line;
  });

  return html += '</div>';
}
