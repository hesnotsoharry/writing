import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Card, Icon, ListRow, SectionLabel, Sheet } from "../../components";
import { getBinderStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import type { Project } from "../../shared/binderStore";
import { subscribeMobileStructureChanged } from "../../sync/mobileEngine";
import { useTheme } from "../../theme/ThemeProvider";
import { projectTypeLabel } from "../projects/projectsModel";

type BinderNavigation = NativeStackNavigationProp<RootStackParamList>;

interface SeededRoute { name: keyof RootStackParamList; params?: object }
interface ProjectSwitchReset { index: number; routes: SeededRoute[] }

/**
 * Switching manuscripts RESETS the stack rather than pushing onto it.
 *
 * The drawer lives inside the scene editor, and that Scene route's params
 * belong to the project being left. Pushing the new project's Hub would leave
 * the abandoned scene underneath it, so back from the new Hub would walk into
 * a manuscript the writer just closed — and the drawer's own binder would no
 * longer match the scene on screen. sceneStack.ts already fixes the editor's
 * logical parent chain as ProjectList -> Hub -> Scene; a project switch lands
 * on that same chain minus the scene, which is exactly where opening a project
 * from the projects list leaves you (ProjectsScreen navigates to Hub).
 */
function projectSwitchReset(project: Project): ProjectSwitchReset {
  return {
    index: 1,
    routes: [
      { name: "ProjectList" },
      { name: "Hub", params: { projectId: project.id, projectTitle: project.title } },
    ],
  };
}

export interface ProjectSwitcher {
  /** False when there is nowhere to switch to — the header stays inert. */
  canSwitch: boolean;
  close(): void;
  isOpen: boolean;
  open(): void;
  projects: Project[];
  select(project: Project): void;
}

/** Same read path the projects list screen uses (projectsModel builds on this
 *  one store call), refreshed on remote structure changes like every other
 *  binder surface — no new query. */
export function useProjectSwitcher(currentProjectId: string): ProjectSwitcher {
  const navigation = useNavigation<BinderNavigation>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const load = useCallback(() => {
    void getBinderStore().then((store) => store.listProjects())
      .then(setProjects).catch(() => undefined);
  }, []);
  useEffect(() => { load(); return subscribeMobileStructureChanged(load); }, [load]);
  const open = useCallback(() => { setIsOpen(true); }, []);
  const close = useCallback(() => { setIsOpen(false); }, []);
  const select = useCallback((project: Project) => {
    setIsOpen(false);
    if (project.id !== currentProjectId) navigation.reset(projectSwitchReset(project));
  }, [currentProjectId, navigation]);
  return { canSwitch: projects.length > 1, close, isOpen, open, projects, select };
}

function ProjectChoiceRow({ current, onPress, project }: {
  current: boolean; onPress(): void; project: Project;
}) {
  const theme = useTheme();
  const type = projectTypeLabel(project.type);
  // The open manuscript is still a live row: tapping it just dismisses, so the
  // check mark reads as "you are here" rather than as a dead control.
  return <ListRow onPress={onPress} title={project.title}
    meta={current ? `${type} · Current` : type}
    trailing={current ? <Icon color={theme.colors.accent} name="check" size={16} /> : undefined} />;
}

export interface ProjectSwitcherSheetProps {
  currentProjectId: string;
  onDismiss(): void;
  onSelect(project: Project): void;
  open: boolean;
  projects: Project[];
}

export function ProjectSwitcherSheet(props: ProjectSwitcherSheetProps) {
  return (
    <Sheet designHeight={380} onDismiss={props.onDismiss} open={props.open} scrollable>
      <View style={styles.content}>
        <SectionLabel>Your manuscripts</SectionLabel>
        <Card radius="small" style={styles.choices}>
          {props.projects.map((project) => (
            <ProjectChoiceRow key={project.id} project={project}
              current={project.id === props.currentProjectId}
              onPress={() => { props.onSelect(project); }} />
          ))}
        </Card>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 24, gap: 12 },
  choices: { paddingVertical: 4, paddingHorizontal: 8 },
});
