import MainLayout from "@/layouts/MainLayout";
import SplitViewLayout from "@/layouts/SplitViewLayout";
import CourseChat from "./CourseChat";
import CourseDetailsContainer from "./CourseDetailsContainer";

interface CoursePageProps {
  params: Promise<{
    slug: string;
    id: string;
  }>
}

export default async function CoursePage(props: CoursePageProps) {
  const { id } = await props.params;

  return (
    <MainLayout>
      <SplitViewLayout
        leftContent={<CourseChat courseId={id} />}
        rightContent={<CourseDetailsContainer
          courseId={id}
        />}
      />
    </MainLayout>
  );
}