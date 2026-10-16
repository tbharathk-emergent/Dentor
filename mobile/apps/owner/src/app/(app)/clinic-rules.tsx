import { Banner, Card, Divider, QueryState, Screen, space, useToast } from '@dentor/shared'
import { View } from 'react-native'
import { RuleSwitch } from '@/components/more/RuleSwitch'
import { useClinicSettings, useSetClinicRule } from '@/hooks/useClinicRules'
import { useRefresh } from '@/hooks/useRefresh'
import { CLINIC_RULES, isRuleOn, type ClinicRule } from '@/lib/rules'

export default function ClinicRulesScreen() {
  const toast = useToast()
  const settings = useClinicSettings()
  const setRule = useSetClinicRule()
  const { refreshing, refresh } = useRefresh(settings)

  const toggle = (rule: ClinicRule, value: boolean) =>
    setRule.mutate(
      { key: rule.key, value },
      {
        onSuccess: () => toast.success(`${rule.title} turned ${value ? 'on' : 'off'}`),
        onError: (error) => toast.error(error, `Could not change "${rule.title}". Please try again.`),
      },
    )

  return (
    <Screen testID="clinic-rules-screen" title="Clinic rules" subtitle="Enforced for everyone in the clinic" back refreshing={refreshing} onRefresh={refresh}>
      <QueryState query={settings}>
        {(values) => (
          <>
            <Banner tone="blue" icon="info" text="A change takes effect straight away, in the reception app and the patient app." />
            <Card padded={false}>
              {CLINIC_RULES.map((rule, index) => (
                <View key={rule.key}>
                  {index > 0 && <Divider inset={space.lg} />}
                  <RuleSwitch
                    rule={rule}
                    on={isRuleOn(values, rule)}
                    saving={setRule.isPending && setRule.variables?.key === rule.key}
                    disabled={setRule.isPending}
                    onToggle={(value) => toggle(rule, value)}
                  />
                </View>
              ))}
            </Card>
          </>
        )}
      </QueryState>
    </Screen>
  )
}
